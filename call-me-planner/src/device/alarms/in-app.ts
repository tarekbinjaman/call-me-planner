import { router } from 'expo-router';

import type { AlarmReminder, AlarmScheduler } from '@/domain/alarms';

type Armed = { reminder: AlarmReminder; timer: ReturnType<typeof setTimeout> };
const armed = new Map<string, Armed>();

/** Voice and ring steps open the ring screen; a heads-up has no in-app form yet. */
function fire(reminder: AlarmReminder) {
  armed.delete(reminder.id);
  if (reminder.channel === 'voice' || reminder.channel === 'ring') {
    router.push({ pathname: '/ring/[reminderId]', params: { reminderId: reminder.id } });
  }
}

/** Expo Go stand-in: timers that only run while the app is open. */
export const inAppScheduler: AlarmScheduler = {
  kind: 'in-app',
  async schedule(reminder) {
    const existing = armed.get(reminder.id);
    if (existing) clearTimeout(existing.timer);
    const delay = Math.max(0, new Date(reminder.fireAt).getTime() - Date.now());
    armed.set(reminder.id, { reminder, timer: setTimeout(() => fire(reminder), delay) });
  },
  async cancel(reminderId) {
    const existing = armed.get(reminderId);
    if (existing) clearTimeout(existing.timer);
    armed.delete(reminderId);
  },
  async cancelAllForTask(taskId) {
    for (const [id, a] of armed) {
      if (a.reminder.taskId !== taskId) continue;
      clearTimeout(a.timer);
      armed.delete(id);
    }
  },
  async armed() {
    return [...armed.values()].map((a) => ({
      id: a.reminder.id,
      taskId: a.reminder.taskId,
      fireAt: a.reminder.fireAt,
    }));
  },
};
