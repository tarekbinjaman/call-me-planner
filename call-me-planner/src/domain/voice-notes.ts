import type { Recording } from '@/data/types';

/** Longest voice note, in seconds. Recording stops by itself at this point. */
export const MAX_RECORDING_S = 60;

/** Shorter than this is treated as an accidental tap, not a recording. */
export const MIN_RECORDING_MS = 700;

/** A press shorter than this starts "tap mode": recording keeps going until the next tap. */
export const HOLD_THRESHOLD_MS = 350;

/** "0:07", "1:00" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function isTooShort(durationMs: number): boolean {
  return durationMs < MIN_RECORDING_MS;
}

/** Seconds left before the automatic stop. */
export function secondsLeft(durationMs: number): number {
  return Math.max(0, MAX_RECORDING_S - Math.floor(durationMs / 1000));
}

/**
 * What the task form will do with the voice note on Save.
 * Nothing touches storage until Save, so Cancel leaves the old note as it was.
 */
export type VoiceNoteDraft =
  { kind: 'keep' } | { kind: 'new'; tempUri: string; durationS: number } | { kind: 'remove' };

export const KEEP: VoiceNoteDraft = { kind: 'keep' };

export type VoiceNotePlan = {
  /** Recording rows to soft-delete, and their files to delete. */
  remove: Pick<Recording, 'id' | 'uri'>[];
  /** A new recording to store, if any. */
  add: { tempUri: string; durationS: number } | null;
};

/** One voice note per task: a new one replaces the old; Remove deletes it. */
export function planVoiceNoteSave(
  existing: Pick<Recording, 'id' | 'uri'>[],
  draft: VoiceNoteDraft,
): VoiceNotePlan {
  switch (draft.kind) {
    case 'keep':
      return { remove: [], add: null };
    case 'remove':
      return { remove: existing, add: null };
    case 'new':
      return {
        remove: existing,
        add: {
          tempUri: draft.tempUri,
          durationS: Math.min(MAX_RECORDING_S, Math.max(1, Math.round(draft.durationS))),
        },
      };
  }
}

/** The note the form should show: the draft if there is one, else the saved note. */
export function visibleNote(
  saved: Pick<Recording, 'uri' | 'durationS'> | null,
  draft: VoiceNoteDraft,
): { uri: string; durationS: number; unsaved: boolean } | null {
  if (draft.kind === 'new') return { uri: draft.tempUri, durationS: draft.durationS, unsaved: true };
  if (draft.kind === 'remove' || !saved) return null;
  return { uri: saved.uri, durationS: saved.durationS, unsaved: false };
}
