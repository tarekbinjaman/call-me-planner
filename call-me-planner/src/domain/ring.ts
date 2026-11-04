import { addDays } from 'date-fns';

import type { ReminderPolicy, ReminderStatus, Task } from '@/data/types';

import { toLocalDate } from './dates';
import { canSnooze, snoozePatch } from './reminder-planner';
import { moveToDayPatch, statusPatch, type TaskPatch } from './tasks';

/** The ring screen rings this long before the ring counts as missed. */
export const RING_TIMEOUT_S = 60;

/** Snooze length offered on the ring screen. */
export const SNOOZE_MIN = 10;

export type RingAnswer = 'done' | 'snooze' | 'tomorrow';

/** What gets written to reminder_event. */
export type RingEvent = 'shown' | 'done' | 'snoozed' | 'moved' | 'missed';

const EVENT_FOR: Record<RingAnswer, RingEvent> = { done: 'done', snooze: 'snoozed', tomorrow: 'moved' };

/** A reminder can still be answered while it is waiting or ringing. */
export function isOpenRing(status: ReminderStatus): boolean {
  return status === 'scheduled' || status === 'fired';
}

export function showSnooze(
  task: Pick<Task, 'snoozeCount'>,
  policy: Pick<ReminderPolicy, 'maxSnoozes'> | null,
): boolean {
  return policy ? canSnooze(task, policy) : false;
}

/**
 * The task change for an answer on the ring screen, or null when it isn't allowed
 * (Snooze after the limit). Done and Move reset the snooze so the next ladder starts fresh.
 */
export function ringAnswerPatch(
  task: Pick<Task, 'dueAt' | 'snoozeCount'>,
  policy: Pick<ReminderPolicy, 'maxSnoozes'> | null,
  answer: RingAnswer,
  now: Date,
): TaskPatch | null {
  const fresh = { snoozedUntil: null, snoozeCount: 0 };
  switch (answer) {
    case 'done':
      return { ...statusPatch('done', now), ...fresh };
    case 'snooze':
      return policy ? snoozePatch(task, policy, now, SNOOZE_MIN) : null;
    case 'tomorrow':
      return { ...moveToDayPatch(task, toLocalDate(addDays(now, 1))), ...fresh };
  }
}

export function ringEventFor(answer: RingAnswer): RingEvent {
  return EVENT_FOR[answer];
}

/** Seconds left before an unanswered ring counts as missed. */
export function ringSecondsLeft(shownAt: Date, now: Date): number {
  return Math.max(0, RING_TIMEOUT_S - Math.floor((now.getTime() - shownAt.getTime()) / 1000));
}
