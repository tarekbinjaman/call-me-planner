import type { Task } from '@/data/types';

import { moveToDayPatch, type TaskPatch } from './tasks';

export type RolloverChange = { id: string; patch: TaskPatch & { carryCount: number } };

/** Open tasks planned for an earlier day than `today` need to move. */
export function needsRollover(
  task: Pick<Task, 'status' | 'scheduledDate' | 'deletedAt'>,
  today: string,
): boolean {
  const open = task.status === 'todo' || task.status === 'doing';
  return open && task.deletedAt === null && task.scheduledDate !== null && task.scheduledDate < today;
}

/**
 * Moves unfinished tasks from past days onto `today` and counts the carry.
 * A due time keeps its clock time on the new day.
 *
 * Safe to run twice: moved tasks are scheduled for `today`, so a second run finds nothing.
 * Each run adds 1 to carryCount, however many days the task was left behind.
 */
export function planRollover(
  tasks: Pick<Task, 'id' | 'status' | 'scheduledDate' | 'dueAt' | 'carryCount' | 'deletedAt'>[],
  today: string,
): RolloverChange[] {
  return tasks
    .filter((t) => needsRollover(t, today))
    .map((t) => ({
      id: t.id,
      patch: { ...moveToDayPatch(t, today), carryCount: t.carryCount + 1 },
    }));
}
