import { router } from 'expo-router';

import type { AlarmScheduler } from '@/domain/alarms';

import { addAlarmListener, CallMeAlarms } from '../../../modules/call-me-alarms';
import { inAppScheduler } from './in-app';
import { createNativeScheduler } from './native';

export type { AlarmScheduler };

const scheduler: AlarmScheduler = CallMeAlarms ? createNativeScheduler(CallMeAlarms) : inAppScheduler;

/**
 * The phone's scheduler: native exact alarms in a dev/store build, the in-app stand-in in
 * Expo Go (where the native module isn't available).
 */
export function getAlarmScheduler(): AlarmScheduler {
  return scheduler;
}

/**
 * While the app is open, a native voice or ring alarm opens the ring screen at once
 * (Android only shows a banner for a full-screen alert when the phone is in use).
 * Returns a function that stops listening.
 */
export function listenForAlarms(): () => void {
  const sub = addAlarmListener((alarm) => {
    if (alarm.channel === 'voice' || alarm.channel === 'ring') {
      router.push({ pathname: '/ring/[reminderId]', params: { reminderId: alarm.id } });
    }
  });
  return () => sub?.remove();
}
