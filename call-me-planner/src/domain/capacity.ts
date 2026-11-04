import type { Task, Workspace } from '@/data/types';

/**
 * Planned time vs the daily hour budget, per workspace per day.
 * Planned time = the estimates of open tasks. Tasks with no estimate are counted separately,
 * so the planned time is a lower bound when some are missing.
 */

type CapacityTask = Pick<Task, 'status' | 'estimateMin'>;
type CapacityGroup = { workspace: Pick<Workspace, 'dailyCapacityMin'> | null; tasks: CapacityTask[] };

export type Capacity = {
  plannedMin: number;
  capacityMin: number;
  /** Open tasks with no estimate, so the planned time is a lower bound. */
  unestimated: number;
  over: boolean;
  ratio: number;
};

export function capacityFor(tasks: CapacityTask[], capacityMin: number): Capacity {
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
export function totalCapacity(groups: CapacityGroup[]): Capacity {
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
