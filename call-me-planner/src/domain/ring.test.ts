import { describe, expect, it } from 'vitest';

import { isOpenRing, ringAnswerPatch, ringEventFor, ringSecondsLeft, showSnooze } from './ring';
import { combineDateTime } from './tasks';

const now = new Date(2026, 10, 4, 10, 10);
const policy = { maxSnoozes: 3 };
const task = { dueAt: combineDateTime('2026-11-04', '10:00'), snoozeCount: 1 };

describe('ringAnswerPatch', () => {
  it('Done closes the task and clears the snooze', () => {
    expect(ringAnswerPatch(task, policy, 'done', now)).toEqual({
      status: 'done',
      completedAt: now.toISOString(),
      snoozedUntil: null,
      snoozeCount: 0,
    });
  });

  it('Snooze pauses for 10 minutes and counts it', () => {
    expect(ringAnswerPatch(task, policy, 'snooze', now)).toEqual({
      snoozedUntil: new Date(2026, 10, 4, 10, 20).toISOString(),
      snoozeCount: 2,
    });
  });

  it('Snooze is refused at the limit, or with no policy', () => {
    expect(ringAnswerPatch({ ...task, snoozeCount: 3 }, policy, 'snooze', now)).toBeNull();
    expect(ringAnswerPatch(task, null, 'snooze', now)).toBeNull();
  });

  it('Move to tomorrow keeps the clock time and clears the snooze', () => {
    expect(ringAnswerPatch(task, policy, 'tomorrow', now)).toEqual({
      scheduledDate: '2026-11-05',
      dueAt: combineDateTime('2026-11-05', '10:00'),
      snoozedUntil: null,
      snoozeCount: 0,
    });
  });
});

describe('ring helpers', () => {
  it('hides Snooze once the limit is reached', () => {
    expect(showSnooze({ snoozeCount: 2 }, policy)).toBe(true);
    expect(showSnooze({ snoozeCount: 3 }, policy)).toBe(false);
    expect(showSnooze({ snoozeCount: 0 }, null)).toBe(false);
  });

  it('only waiting or ringing reminders can be answered', () => {
    expect(isOpenRing('scheduled')).toBe(true);
    expect(isOpenRing('fired')).toBe(true);
    expect(isOpenRing('answered')).toBe(false);
    expect(isOpenRing('missed')).toBe(false);
    expect(isOpenRing('cancelled')).toBe(false);
  });

  it('names the logged event', () => {
    expect(ringEventFor('done')).toBe('done');
    expect(ringEventFor('snooze')).toBe('snoozed');
    expect(ringEventFor('tomorrow')).toBe('moved');
  });

  it('counts down 60 seconds', () => {
    expect(ringSecondsLeft(now, now)).toBe(60);
    expect(ringSecondsLeft(now, new Date(now.getTime() + 45_500))).toBe(15);
    expect(ringSecondsLeft(now, new Date(now.getTime() + 90_000))).toBe(0);
  });
});
