import type { AlarmScheduler } from '@/domain/alarms';

export type { AlarmScheduler };

/** The browser app never rings; it only controls what the phone does (plan 2.3). */
const noAlarms: AlarmScheduler = {
  kind: 'none',
  schedule: async () => {},
  cancel: async () => {},
  cancelAllForTask: async () => {},
  armed: async () => [],
};

export function getAlarmScheduler(): AlarmScheduler {
  return noAlarms;
}
