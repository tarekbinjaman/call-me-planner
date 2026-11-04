import { addDays, format, startOfWeek } from 'date-fns';

import type { Task, Workspace } from '@/data/types';

import { parseLocalDate, toLocalDate } from './dates';

// ---------- Grouping ----------

export type TaskGroup = {
  /** null = tasks without a workspace */
  workspace: Workspace | null;
  tasks: Task[];
};

/**
 * Groups tasks by workspace in the workspaces' own order; tasks without a workspace
 * (or whose workspace was deleted) come last. Inside a group, manual order wins.
 */
export function groupByWorkspace(tasks: Task[], workspaces: Workspace[]): TaskGroup[] {
  const byId = new Map(workspaces.map((w) => [w.id, w]));
  const groups = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const key = t.workspaceId && byId.has(t.workspaceId) ? t.workspaceId : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const sortTasks = (list: Task[]) =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));

  const result: TaskGroup[] = [];
  for (const w of workspaces) {
    const list = groups.get(w.id);
    if (list) result.push({ workspace: w, tasks: sortTasks(list) });
  }
  const loose = groups.get(null);
  if (loose) result.push({ workspace: null, tasks: sortTasks(loose) });
  return result;
}

// ---------- Capacity ----------

export type Capacity = {
  plannedMin: number;
  capacityMin: number;
  /** Open tasks with no estimate, so the planned time is a lower bound. */
  unestimated: number;
  over: boolean;
  ratio: number;
};

export function capacityFor(tasks: Task[], capacityMin: number): Capacity {
  const open = tasks.filter((t) => t.status === 'todo' || t.status === 'doing');
  const plannedMin = open.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0);
  return {
    plannedMin,
    capacityMin,
    unestimated: open.filter((t) => t.estimateMin === null).length,
    over: plannedMin > capacityMin,
    ratio: capacityMin > 0 ? plannedMin / capacityMin : 0,
  };
}

/** Total across groups; only workspaces that have tasks that day count toward capacity. */
export function totalCapacity(groups: TaskGroup[]): Capacity {
  const tasks = groups.flatMap((g) => g.tasks);
  const capacityMin = groups.reduce((sum, g) => sum + (g.workspace?.dailyCapacityMin ?? 0), 0);
  return capacityFor(tasks, capacityMin);
}

export function formatMinutes(min: number): string {
  if (min === 0) return '0 h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export function describeCapacity(c: Capacity): string {
  const base = `${formatMinutes(c.plannedMin)} of ${formatMinutes(c.capacityMin)}`;
  return c.unestimated > 0 ? `${base} · ${c.unestimated} without estimate` : base;
}

// ---------- Overdue / late ----------

export type Timing =
  | { kind: 'overdue'; since: string; carried: number }
  | { kind: 'carried'; carried: number }
  | { kind: 'late' }
  | { kind: 'ok' };

/**
 * overdue = planned for an earlier day and still open (rollover hasn't moved it yet);
 * carried = rollover already moved it here from an earlier day (carryCount > 0);
 * late = has a time today that has already passed.
 */
export function taskTiming(task: Task, now: Date): Timing {
  const open = task.status === 'todo' || task.status === 'doing';
  if (!open) return { kind: 'ok' };
  const today = toLocalDate(now);
  if (task.scheduledDate && task.scheduledDate < today) {
    const d = parseLocalDate(task.scheduledDate);
    return {
      kind: 'overdue',
      since: d ? format(d, 'EEE d MMM') : task.scheduledDate,
      carried: task.carryCount,
    };
  }
  if (task.carryCount > 0) return { kind: 'carried', carried: task.carryCount };
  if (task.dueAt && new Date(task.dueAt).getTime() < now.getTime()) return { kind: 'late' };
  return { kind: 'ok' };
}

// ---------- Reorder ----------

/**
 * Moves the task at `from` to `to` inside one ordered list and returns the new
 * sortOrder for every task whose position changed.
 */
export function reorder(
  tasks: Pick<Task, 'id' | 'sortOrder'>[],
  from: number,
  to: number,
): { id: string; sortOrder: number }[] {
  if (from === to || from < 0 || to < 0 || from >= tasks.length || to >= tasks.length) return [];
  const list = [...tasks];
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved!);
  return list
    .map((t, index) => ({ id: t.id, sortOrder: index, changed: t.sortOrder !== index }))
    .filter((x) => x.changed)
    .map(({ id, sortOrder }) => ({ id, sortOrder }));
}

// ---------- Week (Review) ----------

/** Monday-based week containing `date`: 7 local dates. */
export function weekDays(date: Date): string[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => toLocalDate(addDays(start, i)));
}

export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/** Done tasks per local day of the week (by completedAt). */
export function doneByDay(tasks: Pick<Task, 'completedAt'>[], days: string[]): number[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const day = toLocalDate(new Date(t.completedAt));
    if (counts.has(day)) counts.set(day, counts.get(day)! + 1);
  }
  return days.map((d) => counts.get(d) ?? 0);
}
