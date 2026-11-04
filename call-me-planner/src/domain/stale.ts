import type { Task } from '@/data/types';

import { statusPatch, type TaskPatch } from './tasks';

/** After this many rollovers a task is "stale" and Today asks what to do with it. */
export const STALE_AFTER = 3;

export type StaleChoice = 'today' | 'breakDown' | 'someday' | 'drop';

export const STALE_CHOICES: { value: StaleChoice; label: string; message: string }[] = [
  { value: 'today', label: 'Do today', message: 'Kept for today' },
  { value: 'breakDown', label: 'Break down', message: 'Add smaller steps' },
  { value: 'someday', label: 'Someday', message: 'Moved to Someday' },
  { value: 'drop', label: 'Drop', message: 'Task dropped' },
];

/** An open top-level task that has been carried over STALE_AFTER times or more. */
export function isStale(task: Pick<Task, 'status' | 'carryCount' | 'parentId'>): boolean {
  const open = task.status === 'todo' || task.status === 'doing';
  return open && task.parentId === null && task.carryCount >= STALE_AFTER;
}

/**
 * The change each answer makes. Every answer resets carryCount except Drop (which closes
 * the task), so the prompt only comes back if the task keeps slipping.
 * - today: stays on today, a fresh start
 * - breakDown: stays on today; the screen opens the task to add subtasks
 * - someday: no day and no time. Must-do and critical are cleared too, because a must-do
 *   needs a time for its reminders
 * - drop: status dropped
 */
export function stalePatch(choice: StaleChoice, now: Date = new Date()): TaskPatch {
  switch (choice) {
    case 'today':
    case 'breakDown':
      return { carryCount: 0 };
    case 'someday':
      return { scheduledDate: null, dueAt: null, mustDo: false, critical: false, carryCount: 0 };
    case 'drop':
      return statusPatch('dropped', now);
  }
}
