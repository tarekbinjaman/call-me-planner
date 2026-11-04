import { useEffect } from 'react';

import { getRepos } from '@/data';
import { subscribeToTables } from '@/data/changes';
import { requestReminderSync } from '@/data/reminders';

import { useDatabaseStore } from './database-store';

/**
 * Keeps the reminder table in step with the tasks: once the database is open, and after any
 * change to tasks or reminder policies (done, snooze, move, new time, policy edit, rollover).
 * Writes to the reminder table itself don't trigger it, so it never loops.
 */
export function useReminderSync() {
  const ready = useDatabaseStore((s) => s.state.status === 'ready');

  useEffect(() => {
    if (!ready) return;
    const run = () =>
      void (async () => {
        try {
          await requestReminderSync(await getRepos());
        } catch (error) {
          console.warn('Reminder sync failed', error);
        }
      })();
    run();
    return subscribeToTables(['task', 'reminder_policy'], run);
  }, [ready]);
}
