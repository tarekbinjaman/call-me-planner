import { useEffect } from 'react';

import { getRepos } from '@/data';
import { runRollover } from '@/data/rollover';

import { useDatabaseStore } from './database-store';
import { useToday } from './use-today';

/**
 * Moves unfinished tasks from past days onto today: once the database is open, and again
 * whenever the date changes (midnight, or the app coming back to the foreground on a new day).
 * Screens refresh on their own through the database change listener.
 */
export function useRollover() {
  const ready = useDatabaseStore((s) => s.state.status === 'ready');
  const today = useToday();

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        await runRollover(await getRepos(), today);
      } catch (error) {
        console.warn('Rollover failed', error);
      }
    })();
  }, [ready, today]);
}
