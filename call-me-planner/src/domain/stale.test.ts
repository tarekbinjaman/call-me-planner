import { describe, expect, it } from 'vitest';

import { isStale, stalePatch, STALE_AFTER } from './stale';

describe('isStale', () => {
  const base = { status: 'todo' as const, parentId: null, carryCount: STALE_AFTER };

  it('flags open top-level tasks carried over 3 or more times', () => {
    expect(isStale(base)).toBe(true);
    expect(isStale({ ...base, status: 'doing' })).toBe(true);
    expect(isStale({ ...base, carryCount: 7 })).toBe(true);
  });

  it('ignores fewer carries, closed tasks and subtasks', () => {
    expect(isStale({ ...base, carryCount: 2 })).toBe(false);
    expect(isStale({ ...base, status: 'done' })).toBe(false);
    expect(isStale({ ...base, status: 'dropped' })).toBe(false);
    expect(isStale({ ...base, parentId: 'p' })).toBe(false);
  });
});

describe('stalePatch', () => {
  const now = new Date('2026-11-04T10:00:00.000Z');

  it('Do today and Break down keep the day and reset the carry', () => {
    expect(stalePatch('today', now)).toEqual({ carryCount: 0 });
    expect(stalePatch('breakDown', now)).toEqual({ carryCount: 0 });
  });

  it('Someday clears the day, the time and must-do', () => {
    expect(stalePatch('someday', now)).toEqual({
      scheduledDate: null,
      dueAt: null,
      mustDo: false,
      critical: false,
      carryCount: 0,
    });
  });

  it('Drop closes the task', () => {
    expect(stalePatch('drop', now)).toEqual({ status: 'dropped', completedAt: null });
  });

  it('after any answer the task is no longer stale', () => {
    const task = { status: 'todo' as const, parentId: null, carryCount: 4 };
    for (const choice of ['today', 'breakDown', 'someday', 'drop'] as const) {
      expect(isStale({ ...task, ...stalePatch(choice, now) })).toBe(false);
    }
  });
});
