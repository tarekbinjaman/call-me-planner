import { useEffect, useRef, useState } from 'react';

import { getRepos } from '@/data';
import { subscribeToTables } from '@/data/changes';
import type { Repositories } from '@/data/repositories';

export type LiveQuery<T> = {
  data: T | undefined;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
};

/**
 * Runs a repository query for one screen (e.g. "plans in this workspace") and re-runs it
 * whenever one of `tables` changes. `deps` works like useEffect's dependency list.
 */
export function useLiveQuery<T>(
  tables: string[],
  query: (repos: Repositories) => Promise<T>,
  deps: unknown[],
): LiveQuery<T> {
  const [state, setState] = useState<LiveQuery<T>>({ data: undefined, status: 'loading', error: null });
  const queryRef = useRef(query);
  const requestId = useRef(0);

  // Always use the latest query function without re-subscribing on every render.
  useEffect(() => {
    queryRef.current = query;
  });

  const tableKey = tables.join(',');
  // deps are compared by value (they are ids and dates), like a query key.
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    async function run() {
      const id = ++requestId.current;
      try {
        const data = await queryRef.current(await getRepos());
        if (id === requestId.current) setState({ data, status: 'ready', error: null });
      } catch (error) {
        if (id === requestId.current) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      }
    }
    void run();
    return subscribeToTables(tableKey.split(','), () => void run());
  }, [tableKey, depsKey]);

  return state;
}
