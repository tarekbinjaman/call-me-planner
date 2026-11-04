import { planRollover } from '@/domain/rollover';

import type { Repositories } from './repositories';

/**
 * Moves every open task from a past day onto `today` (see domain `planRollover`).
 * Each task is updated on its own, so if the app is closed half-way the next run
 * finishes the rest. Returns how many tasks moved.
 */
export async function rolloverTasks(repos: Repositories, today: string): Promise<number> {
  const changes = planRollover(await repos.tasks.beforeDay(today), today);
  for (const c of changes) await repos.tasks.update(c.id, c.patch);
  return changes.length;
}

let running: { today: string; promise: Promise<number> } | null = null;

/**
 * App entry point: runs rollover for `today`, sharing one run if it is asked for again
 * while it is still going (app open and a date change can fire together).
 */
export function runRollover(repos: Repositories, today: string): Promise<number> {
  if (running?.today === today) return running.promise;
  const promise = rolloverTasks(repos, today).finally(() => {
    if (running?.promise === promise) running = null;
  });
  running = { today, promise };
  return promise;
}
