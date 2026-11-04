import { describe, expect, it } from 'vitest';

import { describeWorkHours, formatShortDate, isLocalDate, isTime, quickDates } from './dates';
import { describeProgress, planProgress } from './progress';
import { hoursToMinutes, minutesToHours, planFormSchema, workspaceFormSchema } from './schemas';

describe('dates', () => {
  it('validates local dates strictly', () => {
    expect(isLocalDate('2026-11-30')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('30/11/2026')).toBe(false);
    expect(isLocalDate('')).toBe(false);
  });

  it('validates 24-hour times', () => {
    expect(isTime('09:00')).toBe(true);
    expect(isTime('23:59')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(isTime('9:00')).toBe(false);
  });

  it('formats short dates, with the year only when needed', () => {
    const today = new Date(2026, 10, 4);
    expect(formatShortDate('2026-11-30', today)).toBe('Mon 30 Nov');
    expect(formatShortDate('2027-01-15', today)).toBe('15 Jan 2027');
  });

  it('offers quick target dates', () => {
    const values = quickDates(new Date(2026, 10, 4)).map((q) => q.value);
    expect(values).toEqual(['2026-11-11', '2026-11-30', '2026-12-04', '2027-02-04']);
  });

  it('describes work hours', () => {
    expect(describeWorkHours(null)).toBe('No set hours');
    expect(describeWorkHours({ days: [5, 1, 2, 3, 4], start: '09:00', end: '13:00' })).toBe(
      'Mon–Fri 09:00–13:00',
    );
    expect(describeWorkHours({ days: [1, 3], start: '14:00', end: '18:00' })).toBe('Mon, Wed 14:00–18:00');
    expect(describeWorkHours({ days: [6, 0], start: '10:00', end: '12:00' })).toBe('Sat, Sun 10:00–12:00');
  });
});

describe('planProgress', () => {
  it('counts top-level tasks and ignores dropped ones', () => {
    const p = planProgress([
      { status: 'done', parentId: null },
      { status: 'todo', parentId: null },
      { status: 'doing', parentId: null },
      { status: 'dropped', parentId: null },
      { status: 'done', parentId: 'x' },
    ]);
    expect(p).toEqual({ done: 1, total: 3, ratio: 1 / 3 });
    expect(describeProgress(p)).toBe('1 of 3 done');
  });

  it('handles empty and finished plans', () => {
    expect(describeProgress(planProgress([]))).toBe('No tasks yet');
    expect(planProgress([]).ratio).toBe(0);
    expect(describeProgress(planProgress([{ status: 'done', parentId: null }]))).toBe('All 1 done');
  });
});

describe('workspace form', () => {
  const valid = {
    name: 'Company A',
    kind: 'company' as const,
    color: 'wsCompanyA',
    dailyHours: '4',
    hasWorkHours: true,
    workHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '13:00' },
  };

  it('accepts a valid workspace', () => {
    expect(workspaceFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty name, bad hours and backwards times', () => {
    const r = workspaceFormSchema.safeParse({
      ...valid,
      name: '  ',
      dailyHours: 'four',
      workHours: { days: [], start: '13:00', end: '09:00' },
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['name', 'dailyHours', 'workHours.end', 'workHours.days']));
  });

  it('ignores work hours when turned off', () => {
    const r = workspaceFormSchema.safeParse({
      ...valid,
      hasWorkHours: false,
      workHours: { days: [], start: 'x', end: 'y' },
    });
    expect(r.success).toBe(true);
  });

  it('converts hours and minutes', () => {
    expect(hoursToMinutes('2.5')).toBe(150);
    expect(hoursToMinutes('0.33')).toBe(20);
    expect(minutesToHours(240)).toBe('4');
    expect(minutesToHours(150)).toBe('2.5');
  });
});

describe('plan form', () => {
  it('accepts an empty target date and rejects a bad one', () => {
    const base = { name: 'Launch website', goal: '', status: 'active' as const };
    expect(planFormSchema.safeParse({ ...base, targetDate: '' }).success).toBe(true);
    expect(planFormSchema.safeParse({ ...base, targetDate: '2026-12-31' }).success).toBe(true);
    expect(planFormSchema.safeParse({ ...base, targetDate: 'next week' }).success).toBe(false);
  });
});
