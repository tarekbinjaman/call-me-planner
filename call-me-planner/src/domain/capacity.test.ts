import { describe, expect, it } from 'vitest';

import type { Task } from '@/data/types';

import { capacityFor, describeCapacity, formatMinutes, totalCapacity } from './capacity';

const t = (estimateMin: number | null, status: Task['status'] = 'todo') => ({ estimateMin, status });

describe('capacityFor', () => {
  it('adds estimates of open tasks and counts unestimated ones', () => {
    const c = capacityFor([t(60), t(90), t(null), t(120, 'done'), t(30, 'dropped')], 120);
    expect(c).toMatchObject({ plannedMin: 150, capacityMin: 120, unestimated: 1, over: true, ratio: 1.25 });
    expect(describeCapacity(c)).toBe('2 h 30 of 2 h · 1 without estimate');
  });

  it('counts tasks in progress as planned', () => {
    expect(capacityFor([t(45, 'doing')], 240)).toMatchObject({ plannedMin: 45, over: false });
  });

  it('exactly at the budget is not over', () => {
    expect(capacityFor([t(120), t(120)], 240).over).toBe(false);
  });

  it('a workspace with no budget has ratio 0 and is over as soon as anything is planned', () => {
    expect(capacityFor([t(15)], 0)).toMatchObject({ ratio: 0, over: true });
    expect(capacityFor([], 0)).toMatchObject({ ratio: 0, over: false, plannedMin: 0 });
  });
});

describe('totalCapacity', () => {
  it('adds budgets only of workspaces that have tasks that day; loose tasks add time, not budget', () => {
    const c = totalCapacity([
      { workspace: { dailyCapacityMin: 240 }, tasks: [t(30)] },
      { workspace: null, tasks: [t(15)] },
    ]);
    expect(c).toMatchObject({ plannedMin: 45, capacityMin: 240, over: false });
  });
});

describe('formatMinutes', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(0)).toBe('0 h');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(135)).toBe('2 h 15');
  });
});
