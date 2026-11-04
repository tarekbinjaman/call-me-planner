import { describe, expect, it } from 'vitest';

import {
  KEEP,
  MAX_RECORDING_S,
  formatClock,
  isTooShort,
  planVoiceNoteSave,
  secondsLeft,
  visibleNote,
} from './voice-notes';

describe('voice note helpers', () => {
  it('formats a clock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(7.9)).toBe('0:07');
    expect(formatClock(60)).toBe('1:00');
  });

  it('treats very short presses as taps', () => {
    expect(isTooShort(300)).toBe(true);
    expect(isTooShort(1200)).toBe(false);
  });

  it('counts down to the 60 second limit', () => {
    expect(secondsLeft(0)).toBe(60);
    expect(secondsLeft(42_500)).toBe(18);
    expect(secondsLeft(75_000)).toBe(0);
  });
});

describe('planVoiceNoteSave', () => {
  const old = [{ id: 'r1', uri: 'file:///old.m4a' }];

  it('keep changes nothing', () => {
    expect(planVoiceNoteSave(old, KEEP)).toEqual({ remove: [], add: null });
  });

  it('a new note replaces the old one', () => {
    expect(planVoiceNoteSave(old, { kind: 'new', tempUri: 'file:///tmp.m4a', durationS: 12.4 })).toEqual({
      remove: old,
      add: { tempUri: 'file:///tmp.m4a', durationS: 12 },
    });
  });

  it('keeps the stored duration between 1 s and the limit', () => {
    expect(planVoiceNoteSave([], { kind: 'new', tempUri: 'x', durationS: 0.8 }).add?.durationS).toBe(1);
    expect(planVoiceNoteSave([], { kind: 'new', tempUri: 'x', durationS: 61 }).add?.durationS).toBe(
      MAX_RECORDING_S,
    );
  });

  it('remove deletes the old note', () => {
    expect(planVoiceNoteSave(old, { kind: 'remove' })).toEqual({ remove: old, add: null });
  });
});

describe('visibleNote', () => {
  const saved = { uri: 'saved', durationS: 5 };
  it('shows the unsaved draft first, then the saved note', () => {
    expect(visibleNote(saved, { kind: 'new', tempUri: 'tmp', durationS: 3 })).toEqual({
      uri: 'tmp',
      durationS: 3,
      unsaved: true,
    });
    expect(visibleNote(saved, KEEP)).toEqual({ uri: 'saved', durationS: 5, unsaved: false });
    expect(visibleNote(saved, { kind: 'remove' })).toBeNull();
    expect(visibleNote(null, KEEP)).toBeNull();
  });
});
