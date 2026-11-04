import { create } from 'zustand';

import { openDatabase } from '@/data/db';

type DatabaseState =
  | { status: 'opening' }
  | { status: 'ready'; version: number; applied: string[] }
  | { status: 'error'; message: string };

type DatabaseStore = {
  state: DatabaseState;
  open: () => Promise<void>;
};

export const useDatabaseStore = create<DatabaseStore>((set) => ({
  state: { status: 'opening' },
  open: async () => {
    set({ state: { status: 'opening' } });
    try {
      const { migration } = await openDatabase();
      set({ state: { status: 'ready', version: migration.to, applied: migration.applied } });
    } catch (error) {
      set({ state: { status: 'error', message: error instanceof Error ? error.message : String(error) } });
    }
  },
}));
