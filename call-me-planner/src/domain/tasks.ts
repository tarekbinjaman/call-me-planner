import { addDays, format, nextMonday, parseISO } from 'date-fns';
import { z } from 'zod';

import type { Priority, Task, TaskStatus } from '@/data/types';

import { isLocalDate, isTime, parseLocalDate, toLocalDate } from './dates';

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Low' },
];

export function priorityLabel(p: Priority): string {
  return PRIORITIES.find((x) => x.value === p)?.label ?? 'Normal';
}

export const ESTIMATE_CHOICES = [15, 30, 60, 90, 120] as const;

export function formatEstimate(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h ${minutes % 60} min`;
}

// ---------- Dates and due times ----------

/** Local date + 'HH:mm' → ISO timestamp (UTC). */
export function combineDateTime(date: string, time: string): string {
  const day = parseLocalDate(date);
  if (!day || !isTime(time)) throw new Error(`Invalid date/time: ${date} ${time}`);
  const [h, m] = time.split(':').map(Number);
  day.setHours(h ?? 0, m ?? 0, 0, 0);
  return day.toISOString();
}

/** ISO timestamp → local 'HH:mm'. */
export function timeOf(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

/** Quick choices for "which day". */
export function quickDays(today: Date = new Date()) {
  return [
    { label: 'Today', value: toLocalDate(today) },
    { label: 'Tomorrow', value: toLocalDate(addDays(today, 1)) },
    { label: 'Next Monday', value: toLocalDate(nextMonday(today)) },
  ];
}

/** "Today", "Tomorrow", "Yesterday", or a short date. */
export function describeDay(date: string, today: Date = new Date()): string {
  const t = toLocalDate(today);
  if (date === t) return 'Today';
  if (date === toLocalDate(addDays(today, 1))) return 'Tomorrow';
  if (date === toLocalDate(addDays(today, -1))) return 'Yesterday';
  const d = parseLocalDate(date);
  if (!d) return date;
  return format(d, d.getFullYear() === today.getFullYear() ? 'EEE d MMM' : 'd MMM yyyy');
}

// ---------- Status and moving ----------

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'status'
    | 'completedAt'
    | 'scheduledDate'
    | 'dueAt'
    | 'workspaceId'
    | 'planId'
    | 'carryCount'
    | 'mustDo'
    | 'critical'
    | 'snoozedUntil'
    | 'snoozeCount'
  >
>;

/** Patch for a status change; keeps completedAt in step with "done". */
export function statusPatch(status: TaskStatus, now: Date = new Date()): TaskPatch {
  return { status, completedAt: status === 'done' ? now.toISOString() : null };
}

/**
 * Move a task to another day (or to no day with null). A due time keeps its clock time
 * on the new day; with no day, the due time is cleared.
 */
export function moveToDayPatch(task: Pick<Task, 'dueAt'>, day: string | null): TaskPatch {
  if (day === null) return { scheduledDate: null, dueAt: null };
  return {
    scheduledDate: day,
    dueAt: task.dueAt ? combineDateTime(day, timeOf(task.dueAt)) : null,
  };
}

/** Move to another workspace. The plan belongs to the old workspace, so it is cleared. */
export function moveToWorkspacePatch(task: Pick<Task, 'workspaceId' | 'planId'>, workspaceId: string | null) {
  if (task.workspaceId === workspaceId) return {};
  return { workspaceId, planId: null } satisfies TaskPatch;
}

// ---------- Form ----------

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the task a title').max(200, 'Keep the title under 200 characters'),
    notes: z.string().max(2000, 'Keep notes under 2000 characters'),
    workspaceId: z.string().nullable(),
    planId: z.string().nullable(),
    scheduledDate: z
      .string()
      .trim()
      .refine((v) => v === '' || isLocalDate(v), 'Use a date like 2026-11-05'),
    dueTime: z
      .string()
      .trim()
      .refine((v) => v === '' || isTime(v), 'Use 24-hour time like 10:00'),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    estimate: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 960), 'Minutes, 1 to 960'),
    mustDo: z.boolean(),
    critical: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.dueTime && !v.scheduledDate) {
      ctx.addIssue({ code: 'custom', path: ['dueTime'], message: 'Pick a day first' });
    }
    if (v.mustDo && !v.dueTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueTime'],
        message: 'A must-do task needs a time, so the app knows when to remind you',
      });
    }
  });

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const EMPTY_TASK_FORM: TaskFormValues = {
  title: '',
  notes: '',
  workspaceId: null,
  planId: null,
  scheduledDate: '',
  dueTime: '',
  priority: 3,
  estimate: '',
  mustDo: false,
  critical: false,
};

export function taskToForm(task: Task): TaskFormValues {
  return {
    title: task.title,
    notes: task.notes ?? '',
    workspaceId: task.workspaceId,
    planId: task.planId,
    scheduledDate: task.scheduledDate ?? '',
    dueTime: task.dueAt ? timeOf(task.dueAt) : '',
    priority: task.priority,
    estimate: task.estimateMin === null ? '' : String(task.estimateMin),
    mustDo: task.mustDo,
    critical: task.critical,
  };
}

/** Validated form values → task fields to save. */
export function formToTask(v: TaskFormValues) {
  return {
    title: v.title.trim(),
    notes: v.notes.trim() || null,
    workspaceId: v.workspaceId,
    planId: v.workspaceId ? v.planId : null,
    scheduledDate: v.scheduledDate || null,
    dueAt: v.scheduledDate && v.dueTime ? combineDateTime(v.scheduledDate, v.dueTime) : null,
    priority: v.priority,
    estimateMin: v.estimate ? Number(v.estimate) : null,
    mustDo: v.mustDo,
    critical: v.mustDo && v.critical,
  };
}
