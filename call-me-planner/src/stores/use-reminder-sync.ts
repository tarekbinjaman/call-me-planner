import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getRepos } from '@/data';
import { armAlarms } from '@/data/alarms';
import { subscribeToTables } from '@/data/changes';
import { requestReminderSync } from '@/data/reminders';
import { getAlarmScheduler } from '@/device/alarms';

import { useDatabaseStore } from './database-store';

let arming: Promise<unknown> | null = null;
let armAgain = false;

/** One arming run at a time; a request during a run causes one more run after it. */
function requestArm() {
  if (arming) {
    armAgain = true;
    return;
  }
  arming = (async () => {
    do {
      armAgain = false;
      try {
        await armAlarms(await getRepos(), getAlarmScheduler());
      } catch (error) {
        console.warn('Arming alarms failed', error);
      }
    } while (armAgain);
  })().finally(() => {
    arming = null;
  });
}

/**
 * Keeps reminders and alarms in step with the tasks:
 * - task or policy change (done, snooze, move, new time, policy edit, rollover) → re-plan the
 *   reminder table, then re-arm
 * - reminder change (planned, answered, missed) → re-arm
 * - app back in the foreground → re-arm, which tops up the 48-hour window
 */
export function useReminderSync() {
  const ready = useDatabaseStore((s) => s.state.status === 'ready');

  useEffect(() => {
    if (!ready) return;
    const sync = () =>
      void (async () => {
        try {
          await requestReminderSync(await getRepos());
        } catch (error) {
          console.warn('Reminder sync failed', error);
        }
        requestArm();
      })();
    sync();
    const unsubTasks = subscribeToTables(['task', 'reminder_policy'], sync);
    const unsubReminders = subscribeToTables(['reminder'], requestArm);
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') requestArm();
    });
    return () => {
      unsubTasks();
      unsubReminders();
      appState.remove();
    };
  }, [ready]);
}
