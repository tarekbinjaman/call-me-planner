import type { TaskStatus } from '@/data/types';

export type Progress = {
  done: number;
  total: number;
  /** 0..1; 0 when there are no tasks */
  ratio: number;
};

/**
 * Plan progress counts top-level tasks only (subtasks belong to their parent),
 * and leaves dropped tasks out of both sides: dropping a task neither helps nor hurts.
 */
export function planProgress(tasks: { status: TaskStatus; parentId: string | null }[]): Progress {
  const counted = tasks.filter((t) => t.parentId === null && t.status !== 'dropped');
  const done = counted.filter((t) => t.status === 'done').length;
  const total = counted.length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

export function describeProgress({ done, total }: Progress): string {
  if (total === 0) return 'No tasks yet';
  if (done === total) return `All ${total} done`;
  return `${done} of ${total} done`;
}
