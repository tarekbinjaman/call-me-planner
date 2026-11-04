import { create } from 'zustand';

type UndoToast = { id: number; message: string; undo: (() => Promise<void>) | null };

type UndoStore = {
  toast: UndoToast | null;
  show: (message: string, undo?: () => Promise<void>) => void;
  dismiss: (id?: number) => void;
  runUndo: () => Promise<void>;
};

const VISIBLE_MS = 5000;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;

/** One toast at a time at the bottom of the screen, e.g. "Marked done · Undo". */
export const useUndo = create<UndoStore>((set, get) => ({
  toast: null,
  show: (message, undo) => {
    const id = nextId++;
    if (timer) clearTimeout(timer);
    set({ toast: { id, message, undo: undo ?? null } });
    timer = setTimeout(() => get().dismiss(id), VISIBLE_MS);
  },
  dismiss: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null });
  },
  runUndo: async () => {
    const toast = get().toast;
    if (!toast?.undo) return;
    set({ toast: null });
    await toast.undo();
  },
}));
