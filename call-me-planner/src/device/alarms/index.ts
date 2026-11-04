import type { AlarmScheduler } from '@/domain/alarms';

import { inAppScheduler } from './in-app';

export type { AlarmScheduler };

/** The phone's scheduler. Until the native Android module lands, the in-app stand-in. */
export function getAlarmScheduler(): AlarmScheduler {
  return inAppScheduler;
}
