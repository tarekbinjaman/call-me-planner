import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getRepos } from '@/data';
import { scheduleTestRing } from '@/data/ring';

import {
  addSubtask,
  deleteTask,
  moveTaskToDay,
  moveTaskToWorkspace,
  setTaskStatus,
} from '@/data/task-actions';
import type { Task } from '@/data/types';
import { getAlarmScheduler } from '@/device/alarms';
import { describeDay, formatEstimate, priorityLabel, quickDays, timeOf } from '@/domain/tasks';
import { useLiveQuery } from '@/stores/use-live-query';
import { useWorkspaces } from '@/stores/workspaces';
import { Button, ConfirmDeleteButton } from '@/ui/button';
import { Card } from '@/ui/card';
import { ChoiceChips } from '@/ui/choice';
import { EmptyState } from '@/ui/empty-state';
import { QuickAdd } from '@/ui/quick-add';
import { Screen } from '@/ui/screen';
import { TaskRow } from '@/ui/task-row';
import { Text } from '@/ui/text';
import { Radius, Spacing } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';
import { ReadAloudButton, VoiceNotePlayer } from '@/ui/voice-note';
import { useWorkspaceColor } from '@/ui/workspace-color';

const NO_DAY = '__none__';
const INBOX = '__inbox__';

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspaces = useWorkspaces((s) => s.items);
  const colorOf = useWorkspaceColor();
  const theme = useTheme();
  const scheduler = getAlarmScheduler();
  const canRing = scheduler.kind !== 'none';
  const [testRingAt, setTestRingAt] = useState<number | null>(null);
  useEffect(() => {
    if (!testRingAt) return;
    const timer = setTimeout(() => setTestRingAt(null), Math.max(0, testRingAt - Date.now()) + 2000);
    return () => clearTimeout(timer);
  }, [testRingAt]);
  const testRing = async () => {
    await scheduleTestRing(await getRepos(), id, 10);
    setTestRingAt(Date.now() + 10_000);
  };

  const data = useLiveQuery(
    ['task', 'plan', 'workspace', 'recording'],
    async (r) => {
      const task = await r.tasks.getById(id);
      if (!task || task.deletedAt) return null;
      const [workspace, plan, subtasks, parent, notes] = await Promise.all([
        task.workspaceId ? r.workspaces.getById(task.workspaceId) : null,
        task.planId ? r.plans.getById(task.planId) : null,
        r.tasks.subtasks(task.id),
        task.parentId ? r.tasks.getById(task.parentId) : null,
        r.recordings.forTask(task.id),
      ]);
      return { task, workspace, plan, subtasks, parent, note: notes[0] ?? null };
    },
    [id],
  );

  if (data.status === 'ready' && !data.data) {
    return (
      <Screen kind="stack" title="Task not found">
        <EmptyState title="This task doesn't exist" body="It may have been deleted." />
      </Screen>
    );
  }
  const d = data.data;
  if (!d) return <Screen kind="stack" title="" />;
  const { task, workspace, plan, subtasks, parent, note } = d;
  const open = task.status === 'todo' || task.status === 'doing';
  const days = quickDays();

  const details: [string, string][] = [
    ['Workspace', workspace?.name ?? 'Inbox (no workspace)'],
    ['Plan', plan && !plan.deletedAt ? plan.name : 'None'],
    ['Day', task.scheduledDate ? describeDay(task.scheduledDate) : 'Not scheduled'],
    ['Time', task.dueAt ? timeOf(task.dueAt) : 'None'],
    ['Priority', priorityLabel(task.priority)],
    ['Estimate', formatEstimate(task.estimateMin) ?? 'None'],
  ];
  if (task.carryCount > 0) details.push(['Moved forward', `${task.carryCount} times`]);

  return (
    <>
      <Stack.Screen options={{ title: parent ? 'Step' : 'Task' }} />
      <Screen
        kind="stack"
        title={task.title}
        subtitle={parent ? `Step of “${parent.title}”` : undefined}
        headerRight={
          <Button
            label="Edit"
            variant="ghost"
            onPress={() => router.push({ pathname: '/task/edit', params: { id } })}
          />
        }>
        <View style={styles.badges}>
          <Badge
            text={{ todo: 'To do', doing: 'In progress', done: 'Done', dropped: 'Dropped' }[task.status]}
            tone={task.status === 'done' ? 'accent' : 'muted'}
          />
          {task.mustDo ? <Badge text={task.critical ? 'Critical' : 'Must do'} tone="alert" /> : null}
          {workspace ? <View style={[styles.dot, { backgroundColor: colorOf(workspace.color) }]} /> : null}
        </View>

        <View style={styles.actions}>
          {open ? (
            <>
              <Button label="Done" variant="primary" onPress={() => void setTaskStatus(task, 'done')} />
              <Button
                label={task.status === 'doing' ? 'Not started' : 'Start'}
                onPress={() => void setTaskStatus(task, task.status === 'doing' ? 'todo' : 'doing')}
              />
              <Button label="Drop" variant="ghost" onPress={() => void setTaskStatus(task, 'dropped')} />
            </>
          ) : (
            <Button label="Reopen" variant="primary" onPress={() => void setTaskStatus(task, 'todo')} />
          )}
        </View>

        <Card>
          {details.map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text variant="small" color="textMuted" style={styles.detailLabel}>
                {label}
              </Text>
              <Text variant="small" style={styles.flex}>
                {value}
              </Text>
            </View>
          ))}
          {task.notes ? (
            <View style={[styles.notes, { borderTopColor: theme.border }]}>
              <Text>{task.notes}</Text>
            </View>
          ) : null}
          <View style={[styles.notes, { borderTopColor: theme.border }]}>
            {note ? (
              <VoiceNotePlayer key={note.uri} uri={note.uri} durationS={note.durationS} />
            ) : (
              <>
                <Text variant="small" color="textMuted">
                  No voice note. Reminders will read the title aloud. Record one from Edit.
                </Text>
                <ReadAloudButton title={task.title} />
              </>
            )}
            {canRing && task.status !== 'done' && task.status !== 'dropped' ? (
              <View style={styles.testRing}>
                <Button
                  label={testRingAt ? 'Rings in about 10 s…' : 'Test ring in 10 s'}
                  variant="ghost"
                  disabled={!!testRingAt}
                  onPress={() => void testRing()}
                />
                {testRingAt && scheduler.kind === 'in-app' ? (
                  <Text variant="small" color="textMuted">
                    Keep the app open: in Expo Go, rings only work while the app is on screen.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </Card>

        {!parent ? (
          <>
            <View style={styles.section}>
              <Text variant="label" color="textMuted">
                Move to day
              </Text>
              <ChoiceChips
                options={[
                  ...days.map((x) => ({ value: x.value, label: x.label })),
                  { value: NO_DAY, label: 'No day' },
                ]}
                value={task.scheduledDate ?? NO_DAY}
                onChange={(v) => {
                  const value = v as string;
                  const label = days.find((x) => x.value === value)?.label ?? value;
                  void moveTaskToDay(task, value === NO_DAY ? null : value, label);
                }}
              />
            </View>

            <View style={styles.section}>
              <Text variant="label" color="textMuted">
                Move to workspace
              </Text>
              <ChoiceChips
                options={[
                  ...workspaces.map((w) => ({ value: w.id, label: w.name })),
                  { value: INBOX, label: 'Inbox' },
                ]}
                value={task.workspaceId ?? INBOX}
                onChange={(v) => {
                  const value = v as string;
                  const target = workspaces.find((w) => w.id === value);
                  void moveTaskToWorkspace(task, value === INBOX ? null : value, target?.name ?? 'Inbox');
                }}
              />
              {task.planId ? (
                <Text variant="small" color="textMuted">
                  Moving to another workspace takes the task out of its plan.
                </Text>
              ) : null}
            </View>

            <Subtasks task={task} subtasks={subtasks} />
          </>
        ) : null}

        <View style={styles.danger}>
          <ConfirmDeleteButton
            label={parent ? 'Delete step' : 'Delete task'}
            onConfirm={() => {
              void deleteTask(task);
              router.back();
            }}
          />
        </View>
      </Screen>
    </>
  );
}

function Subtasks({ task, subtasks }: { task: Task; subtasks: Task[] }) {
  const done = subtasks.filter((s) => s.status === 'done').length;
  return (
    <View style={styles.section}>
      <Text variant="label" color="textMuted">
        {subtasks.length ? `Steps · ${done} of ${subtasks.length} done` : 'Steps'}
      </Text>
      <QuickAdd
        placeholder="Break it into a small step"
        label="New step"
        onAdd={(title) => addSubtask(task, title, subtasks.length)}
      />
      <View style={styles.list}>
        {subtasks.map((s) => (
          <TaskRow key={s.id} task={s} />
        ))}
      </View>
    </View>
  );
}

function Badge({ text, tone }: { text: string; tone: 'accent' | 'alert' | 'muted' }) {
  const theme = useTheme();
  const look = {
    accent: { bg: theme.accentSoft, fg: theme.accent },
    alert: { bg: theme.alertSoft, fg: theme.alert },
    muted: { bg: theme.surfaceMuted, fg: theme.textMuted },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: look.bg }]}>
      <Text variant="label" style={{ color: look.fg }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginTop: -Spacing.sm,
  },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  dot: { width: 10, height: 10, borderRadius: 5 },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  detailRow: { flexDirection: 'row', gap: Spacing.md },
  detailLabel: { width: 110 },
  notes: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  testRing: { gap: Spacing.xs, alignItems: 'flex-start' },
  section: { gap: Spacing.sm },
  list: { gap: Spacing.sm },
  danger: { marginTop: Spacing.lg },
  flex: { flex: 1, minWidth: 0 },
});
