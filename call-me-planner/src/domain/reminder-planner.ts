import type { Reminder, ReminderChannel, ReminderPolicy, ReminderStep, Task } from '@/data/types';

import { minutesOfDay } from './dates';

/**
 * Reminder planner: task + reminder policy → the reminders that should be waiting.
 * Pure: it is re-run after any change (done, snooze, move, new time, policy edit) and the
 * result is compared with what is already scheduled (see `diffReminders`).
 *
 * Rules
 * - No due time, closed or deleted task → no reminders.
 * - Not a must-do → one heads-up notification at the due time. Only must-dos escalate.
 * - Must-do → every step of the policy ladder at due time + offset.
 * - Snooze → the steps before the ring step are skipped and the ladder restarts with the
 *   ring at `snoozedUntil`, keeping the gaps between the later steps.
 * - Quiet hours → the first loud step (anything but a heads-up) that lands in quiet hours moves
 *   to the end of quiet hours, and every later loud step moves by the same amount, so the
 *   ladder keeps its order and spacing. Critical tasks ignore quiet hours.
 * - Steps whose time has already passed are left out.
 */

export type PlannerTask = Pick<
  Task,
  'id' | 'status' | 'mustDo' | 'critical' | 'dueAt' | 'snoozedUntil' | 'snoozeCount' | 'deletedAt'
>;
export type PlannerPolicy = Pick<ReminderPolicy, 'steps' | 'maxSnoozes' | 'quietStart' | 'quietEnd'>;

export type PlannedReminder = {
  taskId: string;
  stepIndex: number;
  channel: ReminderChannel;
  /** ISO timestamp */
  fireAt: string;
};

const MINUTE = 60_000;

/** A heads-up is a plain notification; every other channel is loud. */
export function isLoud(channel: ReminderChannel): boolean {
  return channel !== 'heads_up';
}

// ---------- Quiet hours ----------

/** True when the local clock time of `at` is inside quiet hours (which may cross midnight). */
export function inQuietHours(at: Date, quietStart: string, quietEnd: string): boolean {
  const start = minutesOfDay(quietStart);
  const end = minutesOfDay(quietEnd);
  if (start === end) return false;
  const m = at.getHours() * 60 + at.getMinutes();
  return start < end ? m >= start && m < end : m >= start || m < end;
}

/** The next moment (at or after `at`) when the local clock reads `quietEnd`. */
export function quietHoursEnd(at: Date, quietEnd: string): Date {
  const end = minutesOfDay(quietEnd);
  const result = new Date(at.getFullYear(), at.getMonth(), at.getDate(), Math.floor(end / 60), end % 60);
  if (result.getTime() < at.getTime()) result.setDate(result.getDate() + 1);
  return result;
}

// ---------- Snooze ----------

/** Whether the ring screen may offer another snooze. */
export function canSnooze(task: Pick<Task, 'snoozeCount'>, policy: Pick<ReminderPolicy, 'maxSnoozes'>) {
  return task.snoozeCount < policy.maxSnoozes;
}

/** Patch for pressing Snooze, or null when the limit is reached. */
export function snoozePatch(
  task: Pick<Task, 'snoozeCount'>,
  policy: Pick<ReminderPolicy, 'maxSnoozes'>,
  now: Date,
  minutes = 10,
): Pick<Task, 'snoozedUntil' | 'snoozeCount'> | null {
  if (!canSnooze(task, policy)) return null;
  return {
    snoozedUntil: new Date(now.getTime() + minutes * MINUTE).toISOString(),
    snoozeCount: task.snoozeCount + 1,
  };
}

// ---------- Planner ----------

type Slot = { stepIndex: number; channel: ReminderChannel; at: number };

function ladder(task: PlannerTask, steps: ReminderStep[], due: number): Slot[] {
  const slots = steps.map((s, i) => ({ stepIndex: i, channel: s.channel, at: due + s.offsetMin * MINUTE }));

  // A snooze only counts if it belongs to this due time: one left over from before the task
  // was moved to a later day would otherwise ring at the wrong time.
  const snoozed = task.snoozedUntil ? new Date(task.snoozedUntil).getTime() : null;
  const firstAt = slots[0]?.at ?? due;
  if (snoozed === null || snoozed < firstAt) return slots;

  const ringIndex = steps.findIndex((s) => s.channel === 'ring');
  if (ringIndex === -1) return slots.filter((s) => s.at >= snoozed);
  const shift = snoozed - (slots[ringIndex]?.at ?? snoozed);
  return slots.slice(ringIndex).map((s) => ({ ...s, at: s.at + shift }));
}

function applyQuietHours(slots: Slot[], policy: PlannerPolicy): Slot[] {
  let shift = 0;
  return slots.map((s) => {
    if (!isLoud(s.channel)) return s;
    const at = s.at + shift;
    if (shift === 0 && inQuietHours(new Date(at), policy.quietStart, policy.quietEnd)) {
      shift = quietHoursEnd(new Date(at), policy.quietEnd).getTime() - s.at;
      return { ...s, at: s.at + shift };
    }
    return { ...s, at };
  });
}

export function planReminders(task: PlannerTask, policy: PlannerPolicy, now: Date): PlannedReminder[] {
  const open = task.status === 'todo' || task.status === 'doing';
  if (!open || task.deletedAt !== null || !task.dueAt) return [];
  const due = new Date(task.dueAt).getTime();
  if (Number.isNaN(due)) return [];

  const steps: ReminderStep[] = task.mustDo ? policy.steps : [{ offsetMin: 0, channel: 'heads_up' }];
  let slots = ladder(task, steps, due);
  if (!task.critical) slots = applyQuietHours(slots, policy);

  return slots
    .filter((s) => s.at > now.getTime())
    .sort((a, b) => a.at - b.at || a.stepIndex - b.stepIndex)
    .map((s) => ({
      taskId: task.id,
      stepIndex: s.stepIndex,
      channel: s.channel,
      fireAt: new Date(s.at).toISOString(),
    }));
}

/** The policy for a workspace, falling back to the default one (workspaceId null). */
export function policyFor<P extends Pick<ReminderPolicy, 'workspaceId'>>(
  policies: P[],
  workspaceId: string | null,
): P | null {
  return (
    (workspaceId ? policies.find((p) => p.workspaceId === workspaceId) : undefined) ??
    policies.find((p) => p.workspaceId === null) ??
    null
  );
}

// ---------- Diff ----------

export type ReminderDiff = {
  /** Ids of scheduled reminders that no longer match the plan. */
  cancel: string[];
  insert: PlannedReminder[];
};

/**
 * Compares the plan with the reminders already waiting for this task.
 * Only future rows still 'scheduled' are touched: rows whose time has passed belong to the
 * alarm code now (they fire, or get logged as missed), and the planner never re-adds past steps.
 */
export function diffReminders(
  existing: Pick<Reminder, 'id' | 'stepIndex' | 'channel' | 'fireAt' | 'status'>[],
  planned: PlannedReminder[],
  now: Date,
): ReminderDiff {
  const key = (r: { stepIndex: number; channel: string; fireAt: string }) =>
    `${r.stepIndex}|${r.channel}|${new Date(r.fireAt).getTime()}`;
  const live = existing.filter(
    (r) => r.status === 'scheduled' && new Date(r.fireAt).getTime() > now.getTime(),
  );
  const wanted = new Set(planned.map(key));
  const have = new Set(live.map(key));
  return {
    cancel: live.filter((r) => !wanted.has(key(r))).map((r) => r.id),
    insert: planned.filter((p) => !have.has(key(p))),
  };
}
