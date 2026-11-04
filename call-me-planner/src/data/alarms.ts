import { alarmDiff, alarmsToArm, alarmText, type AlarmScheduler, type AlarmToArm } from '@/domain/alarms';
import { timeOf } from '@/domain/tasks';

import type { Repositories } from './repositories';
import type { Task } from './types';

/**
 * Makes the phone's armed alarms match the reminder table: arms what is waiting in the next
 * 48 hours and disarms anything that was cancelled, answered or moved. Safe to run often.
 */
export async function armAlarms(
  repos: Repositories,
  scheduler: AlarmScheduler,
  now: Date = new Date(),
): Promise<{ armed: number; disarmed: number }> {
  if (scheduler.kind === 'none') return { armed: 0, disarmed: 0 };
  const waiting = alarmsToArm(
    await repos.reminders.getAll({
      where: "status = 'scheduled' AND fire_at > ?",
      params: [now.toISOString()],
    }),
    now,
  );

  const tasks = new Map<string, Task | null>();
  for (const r of waiting) {
    if (!tasks.has(r.taskId)) tasks.set(r.taskId, await repos.tasks.getById(r.taskId));
  }
  const wanted: AlarmToArm[] = [];
  for (const r of waiting) {
    const task = tasks.get(r.taskId);
    if (!task) continue;
    wanted.push({ ...r, ...alarmText(r.channel, task, task.dueAt ? timeOf(task.dueAt) : null) });
  }

  const diff = alarmDiff(wanted, await scheduler.armed());
  for (const id of diff.disarm) await scheduler.cancel(id);
  for (const a of diff.arm) await scheduler.schedule(a);
  return { armed: diff.arm.length, disarmed: diff.disarm.length };
}
