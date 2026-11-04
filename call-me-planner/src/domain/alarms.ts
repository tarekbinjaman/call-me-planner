import type { Reminder, ReminderChannel } from '@/data/types';

/** Steps the phone handles itself. Phone calls and buddy texts are sent by the server (Phase 2/4). */
export const LOCAL_CHANNELS: readonly ReminderChannel[] = ['heads_up', 'voice', 'ring'];

/** Only arm alarms this far ahead; the rest are topped up on app open (and later by push). */
export const ALARM_WINDOW_H = 48;

export type AlarmReminder = Pick<Reminder, 'id' | 'taskId' | 'channel' | 'fireAt' | 'status'>;

/** What the phone's notification shows. */
export type AlarmText = { title: string; body: string };

/** An alarm ready to arm: the reminder plus its notification text. */
export type AlarmToArm = AlarmReminder & AlarmText;

/** Notification text for a reminder step. `dueTime` is the task's local 'HH:mm', if it has one. */
export function alarmText(
  channel: ReminderChannel,
  task: { title: string; mustDo: boolean },
  dueTime: string | null,
): AlarmText {
  const due = dueTime ? `Due ${dueTime}` : 'Due now';
  if (channel === 'heads_up') return { title: task.title, body: dueTime ? `Coming up · ${due}` : 'Reminder' };
  return {
    title: task.title,
    body: `${task.mustDo ? 'Must do · ' : ''}${due} · tap to answer`,
  };
}

/**
 * Alarm scheduler (plan 1.7): the only thing that turns reminder rows into real alarms.
 * - `native`: Android exact alarms (needs an EAS dev build); rings with the phone locked.
 * - `in-app`: Expo Go stand-in; fires only while the app is open.
 * - `none`: the browser, which never rings.
 * Implementations live in src/device/alarms.
 */
export type AlarmScheduler = {
  readonly kind: 'native' | 'in-app' | 'none';
  schedule(alarm: AlarmToArm): Promise<void>;
  cancel(reminderId: string): Promise<void>;
  cancelAllForTask(taskId: string): Promise<void>;
  /** What is armed right now, so the app can compare it with the reminder table. */
  armed(): Promise<ArmedAlarm[]>;
  /** The ring screen opened: stop the alarm sound for this reminder. */
  stopRinging(reminderId: string): void;
};

export type ArmedAlarm = { id: string; taskId: string; fireAt: string; title?: string };

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

/**
 * Compares what should be armed with what the alarm system has. An alarm whose time or
 * title changed is armed again (arming the same id replaces it).
 */
export function alarmDiff<R extends Pick<Reminder, 'id' | 'fireAt'> & { title?: string }>(
  wanted: R[],
  armed: ArmedAlarm[],
): { arm: R[]; disarm: string[] } {
  const byId = new Map(armed.map((a) => [a.id, a]));
  const wantedIds = new Set(wanted.map((w) => w.id));
  const same = (w: R) => {
    const a = byId.get(w.id);
    if (!a || new Date(a.fireAt).getTime() !== new Date(w.fireAt).getTime()) return false;
    return a.title === undefined || w.title === undefined || a.title === w.title;
  };
  return {
    arm: wanted.filter((w) => !same(w)),
    disarm: armed.filter((a) => !wantedIds.has(a.id)).map((a) => a.id),
  };
}
