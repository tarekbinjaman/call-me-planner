import { describe, expect, it } from 'vitest';

import type { Task, Workspace } from '@/data/types';

import {
  capacityFor,
  describeCapacity,
  doneByDay,
  formatMinutes,
  groupByWorkspace,
  reorder,
  taskTiming,
  totalCapacity,
  weekDays,
} from './day-view';

function task(p: Partial<Task>): Task {
  return {
    id: p.id ?? Math.random().toString(36),
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deletedAt: null,
    workspaceId: null,
    planId: null,
    parentId: null,
    title: 't',
    notes: null,
    status: 'todo',
    priority: 3,
    mustDo: false,
    critical: false,
    scheduledDate: '2026-11-04',
    dueAt: null,
    estimateMin: null,
    carryCount: 0,
    snoozeCount: 0,
    sortOrder: 0,
    completedAt: null,
    ...p,
  };
}

function ws(id: string, capacity = 240): Workspace {
  return {
    id,
    name: id,
    kind: 'company',
    color: 'wsTeal',
    dailyCapacityMin: capacity,
    workHours: null,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  };
}

describe('groupByWorkspace', () => {
  it('follows workspace order, puts loose tasks last, and sorts by manual order', () => {
    const groups = groupByWorkspace(
      [
        task({ id: 'b2', workspaceId: 'b', sortOrder: 2 }),
        task({ id: 'x', workspaceId: null }),
        task({ id: 'a1', workspaceId: 'a', sortOrder: 0 }),
        task({ id: 'b1', workspaceId: 'b', sortOrder: 1 }),
        task({ id: 'gone', workspaceId: 'deleted-ws' }),
      ],
      [ws('a'), ws('b'), ws('c')],
    );
    expect(groups.map((g) => [g.workspace?.id ?? null, g.tasks.map((t) => t.id)])).toEqual([
      ['a', ['a1']],
      ['b', ['b1', 'b2']],
      [null, ['x', 'gone']],
    ]);
  });
});

describe('capacity', () => {
  it('adds estimates of open tasks and counts unestimated ones', () => {
    const c = capacityFor(
      [
        task({ estimateMin: 60 }),
        task({ estimateMin: 90 }),
        task({ estimateMin: null }),
        task({ estimateMin: 120, status: 'done' }),
      ],
      120,
    );
    expect(c).toMatchObject({ plannedMin: 150, capacityMin: 120, unestimated: 1, over: true });
    expect(describeCapacity(c)).toBe('2 h 30 of 2 h · 1 without estimate');
  });

  it('totals only workspaces that appear that day', () => {
    const groups = groupByWorkspace(
      [task({ workspaceId: 'a', estimateMin: 30 }), task({ workspaceId: null, estimateMin: 15 })],
      [ws('a', 240), ws('b', 240)],
    );
    expect(totalCapacity(groups)).toMatchObject({ plannedMin: 45, capacityMin: 240, over: false });
  });

  it('formats minutes', () => {
    expect(formatMinutes(0)).toBe('0 h');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(135)).toBe('2 h 15');
  });
});

describe('taskTiming', () => {
  const now = new Date(2026, 10, 4, 14, 0);
  it('flags tasks from earlier days as overdue', () => {
    expect(taskTiming(task({ scheduledDate: '2026-11-02' }), now)).toEqual({
      kind: 'overdue',
      since: 'Mon 2 Nov',
      carried: 0,
    });
  });
  it('flags tasks that rollover carried onto today', () => {
    expect(taskTiming(task({ scheduledDate: '2026-11-04', carryCount: 2 }), now)).toEqual({
      kind: 'carried',
      carried: 2,
    });
  });
  it('flags a passed time today as late', () => {
    expect(taskTiming(task({ dueAt: new Date(2026, 10, 4, 10, 0).toISOString() }), now)).toEqual({
      kind: 'late',
    });
    expect(taskTiming(task({ dueAt: new Date(2026, 10, 4, 16, 0).toISOString() }), now)).toEqual({
      kind: 'ok',
    });
  });
  it('never flags finished tasks', () => {
    expect(taskTiming(task({ scheduledDate: '2026-11-01', status: 'done' }), now)).toEqual({ kind: 'ok' });
  });
});

describe('reorder', () => {
  const list = [
    { id: 'a', sortOrder: 0 },
    { id: 'b', sortOrder: 1 },
    { id: 'c', sortOrder: 2 },
  ];
  it('moves a task down and renumbers only what changed', () => {
    expect(reorder(list, 0, 1)).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ]);
  });
  it('moves a task up to the top', () => {
    expect(reorder(list, 2, 0)).toEqual([
      { id: 'c', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });
  it('fixes messy sort orders while moving', () => {
    expect(
      reorder(
        [
          { id: 'a', sortOrder: 0 },
          { id: 'b', sortOrder: 0 },
        ],
        1,
        0,
      ),
      // b already has 0, so only a needs a new number
    ).toEqual([{ id: 'a', sortOrder: 1 }]);
  });
  it('ignores moves out of range', () => {
    expect(reorder(list, 0, 3)).toEqual([]);
    expect(reorder(list, 1, 1)).toEqual([]);
  });
});

describe('week', () => {
  it('starts on Monday', () => {
    expect(weekDays(new Date(2026, 10, 4))).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });
  it('counts done tasks per local day', () => {
    const days = weekDays(new Date(2026, 10, 4));
    const counts = doneByDay(
      [
        { completedAt: new Date(2026, 10, 2, 9).toISOString() },
        { completedAt: new Date(2026, 10, 4, 23, 30).toISOString() },
        { completedAt: new Date(2026, 10, 4, 8).toISOString() },
        { completedAt: new Date(2026, 9, 30).toISOString() },
        { completedAt: null },
      ],
      days,
    );
    expect(counts).toEqual([1, 0, 2, 0, 0, 0, 0]);
  });
});
