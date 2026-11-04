import { diffReminders, planReminders, policyFor } from '@/domain/reminder-planner';

import type { Repositories } from './repositories';
import type { Task } from './types';

export type ReminderSyncResult = { inserted: number; cancelled: number };

/**
 * Brings the reminder table in line with the tasks: plans every open task that has a time,
 * inserts what is missing and marks what no longer applies as 'cancelled'.
 * Tasks that were done, dropped, deleted or lost their time are covered too, through the
 * future reminders still waiting for them. Safe to run as often as needed.
 *
 * The alarm code (step 1.7) schedules and cancels the real phone alarms from these rows.
 */
export async function syncReminders(
  repos: Repositories,
  now: Date = new Date(),
): Promise<ReminderSyncResult> {
  const nowIso = now.toISOString();
  const [policies, waiting, timed] = await Promise.all([
    repos.reminderPolicies.getAll(),
    repos.reminders.getAll({ where: "status = 'scheduled' AND fire_at > ?", params: [nowIso] }),
    repos.tasks.getAll({ where: "due_at IS NOT NULL AND status IN ('todo', 'doing')" }),
  ]);

  const tasks = new Map<string, Task>(timed.map((t) => [t.id, t]));
  for (const r of waiting) {
    if (tasks.has(r.taskId)) continue;
    const t = await repos.tasks.getById(r.taskId); // includes soft-deleted tasks
    if (t) tasks.set(t.id, t);
  }

  const waitingByTask = new Map<string, typeof waiting>();
  for (const r of waiting) {
    if (!waitingByTask.has(r.taskId)) waitingByTask.set(r.taskId, []);
    waitingByTask.get(r.taskId)!.push(r);
  }

  let inserted = 0;
  let cancelled = 0;
  const handled = new Set<string>();
  for (const task of tasks.values()) {
    handled.add(task.id);
    const policy = policyFor(policies, task.workspaceId);
    const planned = policy ? planReminders(task, policy, now) : [];
    const diff = diffReminders(waitingByTask.get(task.id) ?? [], planned, now);
    for (const id of diff.cancel) await repos.reminders.update(id, { status: 'cancelled' });
    for (const p of diff.insert) await repos.reminders.insert(p);
    inserted += diff.insert.length;
    cancelled += diff.cancel.length;
  }

  // Reminders whose task no longer exists at all.
  for (const r of waiting) {
    if (handled.has(r.taskId)) continue;
    await repos.reminders.update(r.id, { status: 'cancelled' });
    cancelled += 1;
  }

  return { inserted, cancelled };
}

let running: Promise<ReminderSyncResult> | null = null;
let again = false;

/**
 * App entry point. Runs one sync at a time; a request that arrives during a run causes
 * exactly one more run afterwards, so the last change is always planned.
 */
export function requestReminderSync(repos: Repositories): Promise<ReminderSyncResult> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let result: ReminderSyncResult;
    do {
      again = false;
      result = await syncReminders(repos);
    } while (again);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}
