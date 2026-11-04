import type { Reminder, ReminderChannel } from '@/data/types';

/** Steps the phone handles itself. Phone calls and buddy texts are sent by the server (Phase 2/4). */
export const LOCAL_CHANNELS: readonly ReminderChannel[] = ['heads_up', 'voice', 'ring'];

/** Only arm alarms this far ahead; the rest are topped up on app open (and later by push). */
export const ALARM_WINDOW_H = 48;

export type AlarmReminder = Pick<Reminder, 'id' | 'taskId' | 'channel' | 'fireAt' | 'status'>;

/**
 * Alarm scheduler (plan 1.7): the only thing that turns reminder rows into real alarms.
 * - `native`: Android exact alarms (needs an EAS dev build); rings with the phone locked.
 * - `in-app`: Expo Go stand-in; fires only while the app is open.
 * - `none`: the browser, which never rings.
 * Implementations live in src/device/alarms.
 */
export type AlarmScheduler = {
  readonly kind: 'native' | 'in-app' | 'none';
  schedule(reminder: AlarmReminder): Promise<void>;
  cancel(reminderId: string): Promise<void>;
  cancelAllForTask(taskId: string): Promise<void>;
  /** What is armed right now, so the app can compare it with the reminder table. */
  armed(): Promise<{ id: string; taskId: string; fireAt: string }[]>;
};

/** Reminders that should be armed on the phone right now. */
export function alarmsToArm<R extends AlarmReminder>(reminders: R[], now: Date): R[] {
  const from = now.getTime();
  const to = from + ALARM_WINDOW_H * 3_600_000;
  return reminders
    .filter((r) => {
      const at = new Date(r.fireAt).getTime();
      return r.status === 'scheduled' && LOCAL_CHANNELS.includes(r.channel) && at > from && at <= to;
    })
    .sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

/** Compares what should be armed with what the alarm system has. */
export function alarmDiff<R extends Pick<Reminder, 'id' | 'fireAt'>>(
  wanted: R[],
  armed: { id: string; fireAt: string }[],
): { arm: R[]; disarm: string[] } {
  const armedAt = new Map(armed.map((a) => [a.id, new Date(a.fireAt).getTime()]));
  const wantedIds = new Set(wanted.map((w) => w.id));
  return {
    arm: wanted.filter((w) => armedAt.get(w.id) !== new Date(w.fireAt).getTime()),
    disarm: armed.filter((a) => !wantedIds.has(a.id)).map((a) => a.id),
  };
}
