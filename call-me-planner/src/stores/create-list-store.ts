import { create } from 'zustand';

import { subscribeToTables } from '@/data/changes';
import { getRepos } from '@/data';
import type { Repositories } from '@/data/repositories';

export type ListState<E> = {
  items: E[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  reload: () => Promise<void>;
};

const registry = new Set<() => Promise<void>>();
let dataReady = false;

/** Loads every list store; called once the database is ready. */
export async function reloadAllStores() {
  dataReady = true;
  await Promise.all([...registry].map((reload) => reload()));
}

/**
 * A Zustand store holding one list from the repositories. It reloads by itself whenever
 * any of `tables` changes (a write from a screen, or later a sync), so screens stay current.
 */
export function createListStore<E>(tables: string[], load: (repos: Repositories) => Promise<E[]>) {
  let requestId = 0;

  const useStore = create<ListState<E>>((set, get) => ({
    items: [],
    status: 'idle',
    error: null,
    reload: async () => {
      const id = ++requestId;
      if (get().status === 'idle') set({ status: 'loading' });
      try {
        const items = await load(await getRepos());
        if (id === requestId) set({ items, status: 'ready', error: null });
      } catch (error) {
        if (id === requestId) {
          set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
      }
    },
  }));

  const reload = () => useStore.getState().reload();
  registry.add(reload);
  subscribeToTables(tables, () => void reload());
  // Screens load lazily, so a store can be created after the database is already open.
  if (dataReady) void reload();
  return useStore;
}
