import { describe, expect, it } from 'vitest';

import type { Task } from '@/data/types';

import {
  EMPTY_TASK_FORM,
  combineDateTime,
  describeDay,
  formToTask,
  formatEstimate,
  moveToDayPatch,
  moveToWorkspacePatch,
  quickDays,
  statusPatch,
  taskFormSchema,
  taskToForm,
  timeOf,
} from './tasks';

const today = new Date(2026, 10, 4, 9, 30); // Wed 4 Nov 2026, local time

describe('dates and times', () => {
  it('combines a local day and time and reads the time back', () => {
    const iso = combineDateTime('2026-11-05', '10:15');
    expect(timeOf(iso)).toBe('10:15');
    expect(new Date(iso).getDate()).toBe(5);
  });

  it('describes days relative to today', () => {
    expect(describeDay('2026-11-04', today)).toBe('Today');
    expect(describeDay('2026-11-05', today)).toBe('Tomorrow');
    expect(describeDay('2026-11-03', today)).toBe('Yesterday');
    expect(describeDay('2026-11-20', today)).toBe('Fri 20 Nov');
  });

  it('offers quick days', () => {
    expect(quickDays(today).map((d) => d.value)).toEqual(['2026-11-04', '2026-11-05', '2026-11-09']);
  });

  it('formats estimates', () => {
    expect(formatEstimate(null)).toBeNull();
    expect(formatEstimate(30)).toBe('30 min');
    expect(formatEstimate(120)).toBe('2 h');
    expect(formatEstimate(90)).toBe('1 h 30 min');
  });
});

describe('status and moving', () => {
  it('sets and clears completedAt with done', () => {
    expect(statusPatch('done', today)).toEqual({ status: 'done', completedAt: today.toISOString() });
    expect(statusPatch('todo', today)).toEqual({ status: 'todo', completedAt: null });
    expect(statusPatch('dropped', today)).toEqual({ status: 'dropped', completedAt: null });
  });

  it('keeps the clock time when moving a timed task to another day', () => {
    const task = { dueAt: combineDateTime('2026-11-04', '16:00') };
    const patch = moveToDayPatch(task, '2026-11-06');
    expect(patch.scheduledDate).toBe('2026-11-06');
    expect(timeOf(patch.dueAt!)).toBe('16:00');
    expect(new Date(patch.dueAt!).getDate()).toBe(6);
  });

  it('clears the due time when the day is removed', () => {
    expect(moveToDayPatch({ dueAt: combineDateTime('2026-11-04', '16:00') }, null)).toEqual({
      scheduledDate: null,
      dueAt: null,
    });
  });

  it('clears the plan when moving to another workspace', () => {
    expect(moveToWorkspacePatch({ workspaceId: 'a', planId: 'p' }, 'b')).toEqual({
      workspaceId: 'b',
      planId: null,
    });
    expect(moveToWorkspacePatch({ workspaceId: 'a', planId: 'p' }, 'a')).toEqual({});
  });
});

describe('task form', () => {
  it('needs a title', () => {
    const r = taskFormSchema.safeParse({ ...EMPTY_TASK_FORM, title: ' ' });
    expect(r.success).toBe(false);
  });

  it('needs a day before a time, and a time for must-do', () => {
    const noDay = taskFormSchema.safeParse({ ...EMPTY_TASK_FORM, title: 'x', dueTime: '10:00' });
    expect(noDay.error?.issues.map((i) => i.message)).toContain('Pick a day first');
    const mustDo = taskFormSchema.safeParse({
      ...EMPTY_TASK_FORM,
      title: 'x',
      scheduledDate: '2026-11-05',
      mustDo: true,
    });
    expect(mustDo.success).toBe(false);
  });

  it('rejects bad estimates', () => {
    for (const estimate of ['0', '-5', 'abc', '1000']) {
      expect(taskFormSchema.safeParse({ ...EMPTY_TASK_FORM, title: 'x', estimate }).success).toBe(false);
    }
  });

  it('converts form values to task fields', () => {
    const data = formToTask({
      ...EMPTY_TASK_FORM,
      title: '  Send invoice ',
      workspaceId: 'ws-company-a',
      planId: 'p1',
      scheduledDate: '2026-11-05',
      dueTime: '10:00',
      estimate: '30',
      mustDo: true,
      critical: true,
    });
    expect(data).toMatchObject({
      title: 'Send invoice',
      notes: null,
      workspaceId: 'ws-company-a',
      planId: 'p1',
      scheduledDate: '2026-11-05',
      estimateMin: 30,
      mustDo: true,
      critical: true,
    });
    expect(timeOf(data.dueAt!)).toBe('10:00');
  });

  it('drops the plan without a workspace and critical without must-do', () => {
    const data = formToTask({ ...EMPTY_TASK_FORM, title: 'x', planId: 'p1', critical: true });
    expect(data.planId).toBeNull();
    expect(data.critical).toBe(false);
  });

  it('round-trips a saved task', () => {
    const fields = formToTask({
      ...EMPTY_TASK_FORM,
      title: 'Call bank',
      scheduledDate: '2026-11-05',
      dueTime: '09:45',
      notes: 'Ask about fees',
    });
    const task = { ...fields, id: 't', parentId: null, status: 'todo', carryCount: 0 } as unknown as Task;
    expect(taskToForm(task)).toMatchObject({
      title: 'Call bank',
      scheduledDate: '2026-11-05',
      dueTime: '09:45',
      notes: 'Ask about fees',
    });
  });
});
