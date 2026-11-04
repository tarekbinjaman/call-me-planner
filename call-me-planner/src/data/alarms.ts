import { alarmDiff, alarmsToArm, type AlarmScheduler } from '@/domain/alarms';

import type { Repositories } from './repositories';

/**
 * Makes the phone's armed alarms match the reminder table: arms what is waiting in the next
 * 48 hours and disarms anything that was cancelled, answered or moved. Safe to run often.
 */
export async function armAlarms(
  repos: Repositories,
  scheduler: AlarmScheduler,
  now: Date = new Date(),
): Promise<{ armed: number; disarmed: number }> {
  if (scheduler.kind === 'none') return { armed: 0, disarmed: 0 };
  const waiting = await repos.reminders.getAll({
    where: "status = 'scheduled' AND fire_at > ?",
    params: [now.toISOString()],
  });
  const diff = alarmDiff(alarmsToArm(waiting, now), await scheduler.armed());
  for (const id of diff.disarm) await scheduler.cancel(id);
  for (const r of diff.arm) await scheduler.schedule(r);
  return { armed: diff.arm.length, disarmed: diff.disarm.length };
}
