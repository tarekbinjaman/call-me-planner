import { describe, expect, it } from 'vitest';

import { DEFAULT_REMINDER_STEPS } from '@/data/seed';

import {
  canSnooze,
  diffReminders,
  inQuietHours,
  planReminders,
  policyFor,
  quietHoursEnd,
  snoozePatch,
  type PlannerPolicy,
  type PlannerTask,
} from './reminder-planner';

/** Local time on 4 Nov 2026 (or another day), so tests pass in any time zone. */
const at = (h: number, m = 0, day = 4) => new Date(2026, 10, day, h, m);
const iso = (h: number, m = 0, day = 4) => at(h, m, day).toISOString();

const policy: PlannerPolicy = {
  steps: DEFAULT_REMINDER_STEPS, // -15 heads_up, 0 voice, +10 ring, +20 phone_call, +40 sms_buddy
  maxSnoozes: 3,
  quietStart: '22:00',
  quietEnd: '07:00',
};

function task(p: Partial<PlannerTask> = {}): PlannerTask {
  return {
    id: 't1',
    status: 'todo',
    mustDo: true,
    critical: false,
    dueAt: iso(10),
    snoozedUntil: null,
    snoozeCount: 0,
    deletedAt: null,
    ...p,
  };
}

const times = (plan: ReturnType<typeof planReminders>) =>
  plan.map((r) => [r.channel, new Date(r.fireAt).getHours(), new Date(r.fireAt).getMinutes()]);

describe('planReminders', () => {
  const morning = at(8);

  it('lays out the whole ladder for a must-do', () => {
    expect(times(planReminders(task(), policy, morning))).toEqual([
      ['heads_up', 9, 45],
      ['voice', 10, 0],
      ['ring', 10, 10],
      ['phone_call', 10, 20],
      ['sms_buddy', 10, 40],
    ]);
  });

  it('keeps step indexes and the task id on each reminder', () => {
    const [first] = planReminders(task(), policy, morning);
    expect(first).toEqual({ taskId: 't1', stepIndex: 0, channel: 'heads_up', fireAt: iso(9, 45) });
  });

  it('gives a task that is not a must-do one heads-up at its time', () => {
    expect(times(planReminders(task({ mustDo: false }), policy, morning))).toEqual([['heads_up', 10, 0]]);
  });

  it('plans nothing without a time, or for done, dropped or deleted tasks', () => {
    expect(planReminders(task({ dueAt: null }), policy, morning)).toEqual([]);
    expect(planReminders(task({ status: 'done' }), policy, morning)).toEqual([]);
    expect(planReminders(task({ status: 'dropped' }), policy, morning)).toEqual([]);
    expect(planReminders(task({ deletedAt: iso(7) }), policy, morning)).toEqual([]);
  });

  it('still escalates a task that is in progress', () => {
    expect(planReminders(task({ status: 'doing' }), policy, morning)).toHaveLength(5);
  });

  it('leaves out steps whose time has passed', () => {
    expect(times(planReminders(task(), policy, at(10, 15)))).toEqual([
      ['phone_call', 10, 20],
      ['sms_buddy', 10, 40],
    ]);
    expect(planReminders(task(), policy, at(11))).toEqual([]);
  });

  it('a new due time gives a new ladder', () => {
    expect(times(planReminders(task({ dueAt: iso(15) }), policy, morning))[2]).toEqual(['ring', 15, 10]);
  });

  describe('snooze', () => {
    it('restarts the ladder from the ring at the snooze time, keeping the gaps', () => {
      const t = task({ snoozedUntil: iso(10, 25), snoozeCount: 1 });
      expect(times(planReminders(t, policy, at(10, 15)))).toEqual([
        ['ring', 10, 25],
        ['phone_call', 10, 35],
        ['sms_buddy', 10, 55],
      ]);
    });

    it('ignores a snooze left over from before the task moved to a later day', () => {
      const t = task({ dueAt: iso(10, 0, 5), snoozedUntil: iso(10, 25) });
      expect(times(planReminders(t, policy, at(10, 20)))[0]).toEqual(['heads_up', 9, 45]);
    });

    it('allows snoozes up to the policy limit', () => {
      expect(canSnooze({ snoozeCount: 2 }, policy)).toBe(true);
      expect(canSnooze({ snoozeCount: 3 }, policy)).toBe(false);
      expect(snoozePatch({ snoozeCount: 0 }, policy, at(10, 10))).toEqual({
        snoozedUntil: iso(10, 20),
        snoozeCount: 1,
      });
      expect(snoozePatch({ snoozeCount: 3 }, policy, at(10, 10))).toBeNull();
    });
  });

  describe('quiet hours (22:00–07:00)', () => {
    it('moves loud steps to 07:00 and keeps their spacing; heads-up stays', () => {
      const t = task({ dueAt: iso(23) });
      expect(times(planReminders(t, policy, at(20)))).toEqual([
        ['heads_up', 22, 45],
        ['voice', 7, 0],
        ['ring', 7, 10],
        ['phone_call', 7, 20],
        ['sms_buddy', 7, 40],
      ]);
      expect(new Date(planReminders(t, policy, at(20))[1]!.fireAt).getDate()).toBe(5);
    });

    it('shifts from the first step that falls inside quiet hours', () => {
      const t = task({ dueAt: iso(21, 45) }); // voice 21:45 is fine, ring 21:55 fine, call 22:05 is not
      expect(times(planReminders(t, policy, at(20)))).toEqual([
        ['heads_up', 21, 30],
        ['voice', 21, 45],
        ['ring', 21, 55],
        ['phone_call', 7, 0],
        ['sms_buddy', 7, 20],
      ]);
    });

    it('handles early-morning times before the quiet hours end', () => {
      const t = task({ dueAt: iso(6, 30, 5) });
      expect(times(planReminders(t, policy, at(20)))).toEqual([
        ['heads_up', 6, 15],
        ['voice', 7, 0],
        ['ring', 7, 10],
        ['phone_call', 7, 20],
        ['sms_buddy', 7, 40],
      ]);
    });

    it('critical tasks ring through quiet hours', () => {
      const t = task({ dueAt: iso(23), critical: true });
      expect(times(planReminders(t, policy, at(20)))[1]).toEqual(['voice', 23, 0]);
    });

    it('no quiet hours when start equals end', () => {
      const t = task({ dueAt: iso(23) });
      const open = { ...policy, quietStart: '00:00', quietEnd: '00:00' };
      expect(times(planReminders(t, open, at(20)))[1]).toEqual(['voice', 23, 0]);
    });
  });
});

describe('quiet hour helpers', () => {
  it('inQuietHours handles windows that cross midnight and ones that do not', () => {
    expect(inQuietHours(at(22), '22:00', '07:00')).toBe(true);
    expect(inQuietHours(at(3), '22:00', '07:00')).toBe(true);
    expect(inQuietHours(at(7), '22:00', '07:00')).toBe(false);
    expect(inQuietHours(at(21, 59), '22:00', '07:00')).toBe(false);
    expect(inQuietHours(at(13), '12:00', '14:00')).toBe(true);
    expect(inQuietHours(at(14), '12:00', '14:00')).toBe(false);
  });

  it('quietHoursEnd finds the next end time', () => {
    expect(quietHoursEnd(at(23), '07:00')).toEqual(at(7, 0, 5));
    expect(quietHoursEnd(at(3), '07:00')).toEqual(at(7));
  });
});

describe('policyFor', () => {
  const policies = [
    { id: 'default', workspaceId: null },
    { id: 'a', workspaceId: 'ws-a' },
  ];
  it('uses the workspace policy, else the default', () => {
    expect(policyFor(policies, 'ws-a')?.id).toBe('a');
    expect(policyFor(policies, 'ws-b')?.id).toBe('default');
    expect(policyFor(policies, null)?.id).toBe('default');
    expect(policyFor([], null)).toBeNull();
  });
});

describe('diffReminders', () => {
  const now = at(9);
  const row = (id: string, h: number, m: number, status: 'scheduled' | 'fired' = 'scheduled') => ({
    id,
    stepIndex: 2,
    channel: 'ring' as const,
    fireAt: iso(h, m),
    status,
  });
  const planned = (h: number, m: number) => ({
    taskId: 't1',
    stepIndex: 2,
    channel: 'ring' as const,
    fireAt: iso(h, m),
  });

  it('keeps matching rows, cancels stale ones and inserts new ones', () => {
    expect(
      diffReminders([row('keep', 10, 10), row('old', 11, 10)], [planned(10, 10), planned(12, 10)], now),
    ).toEqual({
      cancel: ['old'],
      insert: [planned(12, 10)],
    });
  });

  it('never touches past or already fired rows', () => {
    expect(diffReminders([row('past', 8, 50), row('fired', 10, 10, 'fired')], [], now)).toEqual({
      cancel: [],
      insert: [],
    });
  });

  it('marking a task done cancels everything still waiting', () => {
    const doneTask = task({ status: 'done' });
    expect(diffReminders([row('a', 10, 10)], planReminders(doneTask, policy, now), now).cancel).toEqual([
      'a',
    ]);
  });
});
