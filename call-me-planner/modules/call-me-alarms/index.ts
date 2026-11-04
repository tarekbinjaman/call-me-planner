import { requireOptionalNativeModule, type EventSubscription, type NativeModule } from 'expo';

export type NativeAlarm = { id: string; taskId: string; channel: string; fireAt: string; title: string };

export type AlarmStatus = { exactAlarms: boolean; notifications: boolean; fullScreen: boolean };

type Events = { onAlarm: (alarm: NativeAlarm) => void };

declare class CallMeAlarmsNative extends NativeModule<Events> {
  schedule(
    id: string,
    taskId: string,
    channel: string,
    fireAtMs: number,
    title: string,
    body: string,
  ): Promise<void>;
  cancel(id: string): Promise<void>;
  cancelAllForTask(taskId: string): Promise<void>;
  armed(): Promise<NativeAlarm[]>;
  stopRinging(id: string): void;
  status(): AlarmStatus;
  openExactAlarmSettings(): void;
}

/**
 * The Android alarm module, or null where it isn't built in (Expo Go, the browser).
 * Native code lives in ./android.
 */
export const CallMeAlarms = requireOptionalNativeModule<CallMeAlarmsNative>('CallMeAlarms');

export function addAlarmListener(listener: (alarm: NativeAlarm) => void): EventSubscription | null {
  return CallMeAlarms ? CallMeAlarms.addListener('onAlarm', listener) : null;
}
