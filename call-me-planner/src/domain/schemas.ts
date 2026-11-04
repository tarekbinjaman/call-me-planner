import { z } from 'zod';

import { isLocalDate, isTime, minutesOfDay } from './dates';

const name = z.string().trim().min(1, 'Give it a name').max(60, 'Keep it under 60 characters');

export const workHoursSchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)),
    start: z.string().refine(isTime, 'Use 24-hour time like 09:00'),
    end: z.string().refine(isTime, 'Use 24-hour time like 17:00'),
  })
  .refine((h) => !isTime(h.start) || !isTime(h.end) || minutesOfDay(h.end) > minutesOfDay(h.start), {
    message: 'End time must be after start time',
    path: ['end'],
  });

export const workspaceFormSchema = z
  .object({
    name,
    kind: z.enum(['personal', 'company']),
    color: z.string().min(1),
    /** Hours per day, as typed in the form (e.g. "4" or "2.5"). */
    dailyHours: z
      .string()
      .trim()
      .refine((v) => /^\d+(\.\d+)?$/.test(v), 'Enter a number of hours, like 4 or 2.5')
      .refine((v) => Number(v) > 0 && Number(v) <= 16, 'Between 0.5 and 16 hours'),
    hasWorkHours: z.boolean(),
    workHours: z.object({ days: z.array(z.number()), start: z.string(), end: z.string() }),
  })
  .superRefine((value, ctx) => {
    if (!value.hasWorkHours) return;
    const result = workHoursSchema.safeParse(value.workHours);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: ['workHours', ...issue.path] });
      }
    }
    if (value.workHours.days.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Pick at least one day', path: ['workHours', 'days'] });
    }
  });

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

export const planFormSchema = z.object({
  name,
  goal: z.string().trim().max(280, 'Keep the goal under 280 characters'),
  status: z.enum(['active', 'paused', 'done']),
  /** '' = no target date */
  targetDate: z
    .string()
    .trim()
    .refine((v) => v === '' || isLocalDate(v), 'Use a date like 2026-12-31'),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

/** Form hours → stored minutes, rounded to 5 minutes. */
export function hoursToMinutes(hours: string): number {
  return Math.round((Number(hours) * 60) / 5) * 5;
}

export function minutesToHours(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100);
}
