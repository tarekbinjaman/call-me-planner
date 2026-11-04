import type { AlarmScheduler } from '@/domain/alarms';

import { CallMeAlarms } from '../../../modules/call-me-alarms';

type Native = NonNullable<typeof CallMeAlarms>;

/** Android exact alarms (modules/call-me-alarms). Rings with the phone locked and the app closed. */
export function createNativeScheduler(native: Native): AlarmScheduler {
  return {
    kind: 'native',
    schedule: (a) =>
      native.schedule(a.id, a.taskId, a.channel, new Date(a.fireAt).getTime(), a.title, a.body),
    cancel: (id) => native.cancel(id),
    cancelAllForTask: (taskId) => native.cancelAllForTask(taskId),
    armed: () => native.armed(),
    stopRinging: (id) => native.stopRinging(id),
  };
}
