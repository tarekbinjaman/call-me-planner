import {
  AudioQuality,
  IOSOutputFormat,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { deleteRecordingFile } from '@/device/audio/recording-files';
import { speakTaskTitle, stopSpeaking } from '@/device/audio/speak';
import {
  HOLD_THRESHOLD_MS,
  MAX_RECORDING_S,
  formatClock,
  isTooShort,
  secondsLeft,
} from '@/domain/voice-notes';

import { Button } from './button';
import { Card } from './card';
import { Text } from './text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

/** The first audio type this browser can record (Safari has no WebM). */
function webMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
}

/** Plan 1.6: AAC, mono, 60 s max. 64 kbps is plenty for speech. */
const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.HIGH },
  web: { mimeType: Platform.OS === 'web' ? webMimeType() : undefined, bitsPerSecond: 64000 },
};

// ---------- Microphone permission ----------

type MicState = 'checking' | 'granted' | 'ask' | 'blocked';

function useMicPermission() {
  const [state, setState] = useState<MicState>('checking');
  const apply = (r: { granted: boolean; canAskAgain: boolean }) =>
    setState(r.granted ? 'granted' : r.canAskAgain ? 'ask' : 'blocked');

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then(apply)
      .catch(() => setState('ask'));
  }, []);

  const request = useCallback(async () => {
    try {
      apply(await requestRecordingPermissionsAsync());
    } catch {
      setState('blocked');
    }
  }, []);

  return { state, request };
}

/** Explains why the app wants the microphone before the system asks. */
function MicExplanation({ blocked, onAllow }: { blocked: boolean; onAllow: () => void }) {
  return (
    <Card testID="mic-explanation">
      <Text variant="bodyStrong">Record reminders in your own voice</Text>
      <Text variant="small" color="textMuted">
        Say what the task is and why it matters. When the reminder rings, it plays your voice, which is much
        harder to ignore than a beep.
      </Text>
      <Text variant="small" color="textMuted">
        The microphone is only on while you record, up to {MAX_RECORDING_S} seconds.
        {Platform.OS === 'web' ? ' Recordings are saved in this browser.' : ' Recordings stay on this phone.'}
      </Text>
      {blocked ? (
        <>
          <Text variant="small" color="alert">
            {Platform.OS === 'web'
              ? 'The microphone is blocked for this site. Allow it in the browser’s site settings (the icon next to the address), then reload.'
              : 'The microphone is turned off for Call-Me Planner. Turn it on in Settings.'}
          </Text>
          {Platform.OS !== 'web' ? (
            <Button label="Open Settings" onPress={() => void Linking.openSettings()} style={styles.left} />
          ) : null}
        </>
      ) : (
        <Button label="Allow microphone" variant="primary" onPress={onAllow} style={styles.left} />
      )}
    </Card>
  );
}

// ---------- Recorder ----------

/**
 * Hold to record, release to stop. A quick tap starts "tap mode" instead: recording keeps
 * going until the next tap, which also suits screen readers and mouse users.
 * Stops by itself at the 60 second limit. Very short recordings are thrown away.
 */
function RecordButton({
  hasNote,
  onRecorded,
}: {
  hasNote: boolean;
  onRecorded: (tempUri: string, durationS: number) => void;
}) {
  const theme = useTheme();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recState = useAudioRecorderState(recorder, 200);
  const [phase, setPhaseState] = useState<'idle' | 'holding' | 'tapMode'>('idle');
  // Press-in and press-out can arrive before React re-renders, so handlers read the ref.
  const phaseRef = useRef(phase);
  const setPhase = useCallback((p: 'idle' | 'holding' | 'tapMode') => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const starting = useRef<Promise<boolean> | null>(null);
  const startedAt = useRef(0);
  const pressedAt = useRef(0);
  const ignoreNextRelease = useRef(false);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    limitTimer.current = null;
    tickTimer.current = null;
  };

  const stop = useCallback(async () => {
    const ok = await starting.current;
    starting.current = null;
    clearTimers();
    setPhase('idle');
    if (!ok) return;
    const durationMs = Date.now() - startedAt.current;
    try {
      await recorder.stop();
    } finally {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
    const uri = recorder.uri;
    if (!uri) {
      setMessage('Recording failed. Try again.');
      return;
    }
    if (isTooShort(durationMs)) {
      deleteRecordingFile(uri);
      setMessage('Hold the button while you speak.');
      return;
    }
    onRecorded(uri, durationMs / 1000);
  }, [recorder, onRecorded, setPhase]);

  const start = useCallback(() => {
    setMessage(null);
    setElapsedMs(0);
    void stopSpeaking();
    starting.current = (async () => {
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        startedAt.current = Date.now();
        tickTimer.current = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 250);
        limitTimer.current = setTimeout(() => void stop(), MAX_RECORDING_S * 1000);
        return true;
      } catch (error) {
        setPhase('idle');
        setMessage(`Couldn't start recording: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    })();
  }, [recorder, stop, setPhase]);

  // Leaving the screen mid-recording throws the recording away.
  useEffect(
    () => () => {
      clearTimers();
      if (starting.current) {
        void starting.current.then(async (ok) => {
          if (!ok) return;
          await recorder.stop().catch(() => {});
          if (recorder.uri) deleteRecordingFile(recorder.uri);
        });
      }
    },
    [recorder],
  );

  const onPressIn = () => {
    if (phaseRef.current === 'tapMode') {
      ignoreNextRelease.current = true;
      void stop();
      return;
    }
    pressedAt.current = Date.now();
    setPhase('holding');
    start();
  };

  const onPressOut = () => {
    if (ignoreNextRelease.current) {
      ignoreNextRelease.current = false;
      return;
    }
    if (phaseRef.current === 'idle') return;
    if (Date.now() - pressedAt.current < HOLD_THRESHOLD_MS) {
      setPhase('tapMode');
      return;
    }
    void stop();
  };

  const recording = phase !== 'idle';
  const shownMs = recording ? Math.max(elapsedMs, recState.durationMillis) : 0;
  const label = recording
    ? phase === 'tapMode'
      ? `Recording ${formatClock(shownMs / 1000)} · tap to stop`
      : `Recording ${formatClock(shownMs / 1000)} · release to stop`
    : hasNote
      ? 'Hold to record again'
      : 'Hold to record a voice note';

  return (
    <View style={styles.recorder}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Record voice note'}
        accessibilityHint="Hold while you speak and release to stop, or tap once to start and tap again to stop."
        accessibilityState={{ busy: recording }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID="record-button"
        style={({ pressed }) => [
          styles.recordButton,
          {
            backgroundColor: recording ? theme.alert : theme.surface,
            borderColor: recording ? theme.alert : theme.border,
          },
          pressed && !recording && { opacity: 0.8 },
        ]}>
        <View style={[styles.dot, { backgroundColor: recording ? theme.onAccent : theme.alert }]} />
        <Text variant="bodyStrong" style={{ color: recording ? theme.onAccent : theme.text }}>
          {label}
        </Text>
      </Pressable>
      {recording && secondsLeft(shownMs) <= 10 ? (
        <Text variant="small" color="alert">{`Stops in ${secondsLeft(shownMs)} s`}</Text>
      ) : null}
      {message ? (
        <Text variant="small" color="alert" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- Player ----------

export function VoiceNotePlayer({ uri, durationS }: { uri: string; durationS: number }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    void stopSpeaking();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    if (status.duration > 0 && status.currentTime >= status.duration - 0.05) await player.seekTo(0);
    player.play();
  };

  const total = status.duration > 0 && Number.isFinite(status.duration) ? status.duration : durationS;
  return (
    <View style={styles.playerRow}>
      <Button
        label={status.playing ? 'Pause' : 'Play'}
        variant="primary"
        onPress={() => void toggle()}
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
      />
      <Text variant="small" color="textMuted">
        {status.playing || status.currentTime > 0
          ? `${formatClock(status.currentTime)} / ${formatClock(total)}`
          : `Voice note · ${formatClock(total)}`}
      </Text>
      {status.error ? <Text variant="small" color="alert">{`Can't play: ${status.error}`}</Text> : null}
    </View>
  );
}

/** Reads the title aloud: what reminders play when a task has no voice note. */
export function ReadAloudButton({ title }: { title: string }) {
  const [speaking, setSpeaking] = useState(false);
  return (
    <Button
      label={speaking ? 'Stop' : 'Read title aloud'}
      variant="ghost"
      onPress={() => {
        if (speaking) {
          void stopSpeaking();
          setSpeaking(false);
        } else {
          setSpeaking(true);
          speakTaskTitle(title, () => setSpeaking(false));
        }
      }}
      style={styles.left}
    />
  );
}

// ---------- Form section ----------

/**
 * Voice note section of the task form. Shows the current note (saved, or recorded but not
 * yet saved), and lets you record, re-record or remove it. Changes apply when the form is saved.
 */
export function VoiceNoteField({
  note,
  title,
  onRecorded,
  onRemove,
}: {
  note: { uri: string; durationS: number; unsaved: boolean } | null;
  title: string;
  onRecorded: (tempUri: string, durationS: number) => void;
  onRemove: () => void;
}) {
  const mic = useMicPermission();
  const [explain, setExplain] = useState(false);

  return (
    <View style={styles.section} testID="voice-note">
      <Text variant="label" color="textMuted">
        Voice note (optional)
      </Text>

      {note ? (
        <View style={styles.noteBox}>
          <VoiceNotePlayer key={note.uri} uri={note.uri} durationS={note.durationS} />
          <View style={styles.playerRow}>
            {note.unsaved ? (
              <Text variant="small" color="textMuted">
                New recording, saved when you save the task.
              </Text>
            ) : null}
            <Button label="Delete recording" variant="danger" onPress={onRemove} />
          </View>
        </View>
      ) : (
        <Text variant="small" color="textMuted">
          No voice note. Reminders will read the title aloud instead.
        </Text>
      )}

      {mic.state === 'granted' ? (
        <RecordButton hasNote={!!note} onRecorded={onRecorded} />
      ) : mic.state === 'checking' ? null : explain || mic.state === 'blocked' ? (
        <MicExplanation blocked={mic.state === 'blocked'} onAllow={() => void mic.request()} />
      ) : (
        <Button label="Record a voice note" onPress={() => setExplain(true)} style={styles.left} />
      )}

      {!note && title.trim() ? <ReadAloudButton title={title} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  noteBox: { gap: Spacing.sm },
  recorder: { gap: Spacing.xs },
  recordButton: {
    minHeight: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    userSelect: 'none',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  left: { alignSelf: 'flex-start' },
});
