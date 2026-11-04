import { policyFor, TEST_STEP } from '@/domain/reminder-planner';
import { isOpenRing, ringAnswerPatch, ringEventFor, type RingAnswer, type RingEvent } from '@/domain/ring';

import type { Repositories } from './repositories';

async function logEvent(repos: Repositories, reminderId: string, event: RingEvent, now: Date) {
  await repos.reminderEvents.insert({ reminderId, event, at: now.toISOString() });
}

/** The ring screen opened: the reminder is now ringing. */
export async function markRingShown(repos: Repositories, reminderId: string, now = new Date()) {
  const reminder = await repos.reminders.getById(reminderId);
  if (!reminder || reminder.status !== 'scheduled') return;
  await repos.reminders.update(reminderId, { status: 'fired' });
  await logEvent(repos, reminderId, 'shown', now);
}

export type AnswerResult = 'ok' | 'already_answered' | 'not_found' | 'snooze_limit';

/**
 * Done / Snooze / Move to tomorrow from the ring screen. Updates the task (the reminder sync
 * then cancels or re-plans the rest of the ladder), closes this reminder and logs the answer.
 * A second tap on an already answered ring does nothing.
 */
export async function answerRing(
  repos: Repositories,
  reminderId: string,
  answer: RingAnswer,
  now = new Date(),
): Promise<AnswerResult> {
  const reminder = await repos.reminders.getById(reminderId);
  if (!reminder) return 'not_found';
  if (!isOpenRing(reminder.status)) return 'already_answered';
  const task = await repos.tasks.getById(reminder.taskId);
  if (!task) return 'not_found';

  const policy = policyFor(await repos.reminderPolicies.getAll(), task.workspaceId);
  const patch = ringAnswerPatch(task, policy, answer, now);
  if (!patch) return 'snooze_limit';

  await repos.reminders.update(reminderId, { status: 'answered' });
  await logEvent(repos, reminderId, ringEventFor(answer), now);
  await repos.tasks.update(task.id, patch);
  return 'ok';
}

/**
 * "Test ring": a one-off ring for this task in `seconds`, outside its reminder ladder, so you
 * can check the ring screen (and later, that alarms fire with the phone locked).
 */
export async function scheduleTestRing(repos: Repositories, taskId: string, seconds = 10, now = new Date()) {
  return repos.reminders.insert({
    taskId,
    stepIndex: TEST_STEP,
    channel: 'ring',
    fireAt: new Date(now.getTime() + seconds * 1000).toISOString(),
  });
}

/** Nobody answered within the ring timeout: log it as missed. */
export async function markRingMissed(repos: Repositories, reminderId: string, now = new Date()) {
  const reminder = await repos.reminders.getById(reminderId);
  if (!reminder || !isOpenRing(reminder.status)) return false;
  await repos.reminders.update(reminderId, { status: 'missed' });
  await logEvent(repos, reminderId, 'missed', now);
  return true;
}
