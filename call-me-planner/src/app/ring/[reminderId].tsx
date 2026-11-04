import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRepos } from '@/data';
import { answerRing, markRingMissed, markRingShown, type AnswerResult } from '@/data/ring';
import { getAlarmScheduler } from '@/device/alarms';
import { speakTaskTitle, stopSpeaking } from '@/device/audio/speak';
import { policyFor } from '@/domain/reminder-planner';
import { ringSecondsLeft, SNOOZE_MIN, showSnooze, type RingAnswer } from '@/domain/ring';
import { timeOf } from '@/domain/tasks';
import { useLiveQuery } from '@/stores/use-live-query';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { Radius, Spacing } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';
import { useWorkspaceColor } from '@/ui/workspace-color';

/** Plays the voice note on a loop, or reads the title aloud every few seconds, while `active`. */
function RingSound({ uri, title, active }: { uri: string | null; title: string; active: boolean }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(true);

  useEffect(() => {
    if (!active) return;
    stopped.current = false;
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    if (uri) {
      player.play();
    } else {
      const say = () => {
        if (stopped.current) return;
        speakTaskTitle(title, () => {
          if (!stopped.current) speakTimer.current = setTimeout(say, 2500);
        });
      };
      say();
    }
    return () => {
      stopped.current = true;
      if (speakTimer.current) clearTimeout(speakTimer.current);
      if (uri) player.pause();
      void stopSpeaking();
    };
  }, [active, uri, title, player]);

  // Loop the voice note: start again each time it finishes, while still ringing.
  useEffect(() => {
    if (!active || !uri || !status.didJustFinish) return;
    void player.seekTo(0).then(() => {
      if (!stopped.current) player.play();
    });
  }, [active, uri, status.didJustFinish, player]);

  return null;
}

/**
 * The ring screen (plan 1.7): full screen, over everything. Rings for 60 seconds with the
 * task's voice note (or its title read aloud), then logs a missed ring and the ladder moves on.
 */
export default function RingScreen() {
  const { reminderId } = useLocalSearchParams<{ reminderId: string }>();
  const theme = useTheme();
  const colorOf = useWorkspaceColor();
  const [shownAt] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [answered, setAnswered] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);

  const data = useLiveQuery(
    ['reminder', 'task', 'recording', 'reminder_policy'],
    async (r) => {
      const reminder = await r.reminders.getById(reminderId);
      if (!reminder) return null;
      const task = await r.tasks.getById(reminder.taskId);
      if (!task) return null;
      const [workspace, notes, policies] = await Promise.all([
        task.workspaceId ? r.workspaces.getById(task.workspaceId) : null,
        r.recordings.forTask(task.id),
        r.reminderPolicies.getAll(),
      ]);
      return {
        reminder,
        task,
        workspace,
        note: notes[0] ?? null,
        policy: policyFor(policies, task.workspaceId),
      };
    },
    [reminderId],
  );

  // Mark as ringing once; tick the countdown; log a miss at the timeout.
  useEffect(() => {
    getAlarmScheduler().stopRinging(reminderId);
    void (async () => markRingShown(await getRepos(), reminderId))();
  }, [reminderId]);
  const secondsLeft = ringSecondsLeft(shownAt, now);
  // A refused answer (no snoozes left, already answered) stops the ringing and shows why.
  const outcome: 'ringing' | 'missed' | AnswerResult = answered ?? (secondsLeft > 0 ? 'ringing' : 'missed');
  const ringing = outcome === 'ringing';
  useEffect(() => {
    if (!ringing) return;
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, [ringing]);
  const missed = outcome === 'missed';
  useEffect(() => {
    if (!missed) return;
    void (async () => markRingMissed(await getRepos(), reminderId))();
  }, [missed, reminderId]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const answer = async (choice: RingAnswer) => {
    setBusy(true);
    try {
      const result = await answerRing(await getRepos(), reminderId, choice);
      if (result === 'ok') close();
      else setAnswered(result);
    } finally {
      setBusy(false);
    }
  };

  const d = data.data;
  const task = d?.task;
  const color = d?.workspace ? colorOf(d.workspace.color) : theme.accent;
  const canSnooze = task && d ? showSnooze(task, d.policy) : false;

  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        {task ? <RingSound uri={d?.note?.uri ?? null} title={task.title} active={ringing} /> : null}

        <View style={[styles.band, { backgroundColor: color }]} />

        {data.status === 'ready' && !d ? (
          <View style={styles.body}>
            <Text variant="heading">This reminder no longer exists</Text>
            <Button label="Close" variant="primary" onPress={close} />
          </View>
        ) : task && d ? (
          <View style={styles.body}>
            <View style={styles.top}>
              <Text variant="label" style={{ color }}>
                {d.workspace?.name ?? 'Inbox'}
                {task.critical ? ' · critical' : task.mustDo ? ' · must do' : ''}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {task.title}
              </Text>
              <Text color="textMuted">
                {[
                  task.dueAt ? `Due ${timeOf(task.dueAt)}` : null,
                  task.snoozeCount > 0 && d.policy
                    ? `Snoozed ${task.snoozeCount} of ${d.policy.maxSnoozes}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {d.note ? null : (
                <Text variant="small" color="textMuted">
                  No voice note, so the title is read aloud.
                </Text>
              )}
            </View>

            <View
              style={[styles.status, { backgroundColor: ringing ? theme.alertSoft : theme.surfaceMuted }]}>
              <Text
                variant="bodyStrong"
                color={ringing ? 'alert' : 'textMuted'}
                accessibilityLiveRegion="polite">
                {ringing
                  ? `Ringing · ${secondsLeft} s`
                  : outcome === 'missed'
                    ? 'Missed. The next reminder step will follow.'
                    : outcome === 'snooze_limit'
                      ? 'No snoozes left. Do it now or move it to tomorrow.'
                      : outcome === 'already_answered'
                        ? 'This reminder was already answered.'
                        : 'This task no longer exists.'}
              </Text>
            </View>

            <View style={styles.actions}>
              <Button
                label="Done"
                variant="primary"
                disabled={busy}
                onPress={() => void answer('done')}
                style={styles.big}
              />
              {canSnooze ? (
                <Button
                  label={`Snooze ${SNOOZE_MIN} min`}
                  disabled={busy}
                  onPress={() => void answer('snooze')}
                  style={styles.big}
                />
              ) : null}
              <Button
                label="Move to tomorrow"
                disabled={busy}
                onPress={() => void answer('tomorrow')}
                style={styles.big}
              />
              {!ringing ? <Button label="Close" variant="ghost" onPress={close} /> : null}
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  band: { height: 8 },
  body: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.xl,
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  top: { gap: Spacing.sm, marginTop: Spacing.xl },
  status: { borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center' },
  actions: { gap: Spacing.md },
  big: { minHeight: 64 },
});
