import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { toggleTaskDone } from '@/data/task-actions';
import type { Task, Workspace } from '@/data/types';
import { taskTiming } from '@/domain/day-view';
import { describeDay, formatEstimate, timeOf } from '@/domain/tasks';

import { Text } from './text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';
import { useWorkspaceColor } from './workspace-color';

type TaskRowProps = {
  task: Task;
  /** Show the workspace name and color (for mixed lists like Today). */
  workspace?: Workspace | null;
  /** Show the scheduled day (for lists that span days). */
  showDay?: boolean;
  subtaskCount?: { done: number; total: number };
  /** When set, flags overdue (from an earlier day) and late (time passed) tasks. */
  now?: Date;
  /** Reorder mode: shows move up / move down buttons instead of opening the task. */
  reorder?: { onUp?: () => void; onDown?: () => void };
};

/** One task: a round checkbox (done/undo) and the rest of the row opens the task. */
export function TaskRow({ task, workspace, showDay = false, subtaskCount, now, reorder }: TaskRowProps) {
  const theme = useTheme();
  const colorOf = useWorkspaceColor();
  const done = task.status === 'done';
  const dropped = task.status === 'dropped';
  const closed = done || dropped;

  const meta: string[] = [];
  if (workspace) meta.push(workspace.name);
  if (showDay && task.scheduledDate) meta.push(describeDay(task.scheduledDate));
  if (task.dueAt) meta.push(timeOf(task.dueAt));
  const estimate = formatEstimate(task.estimateMin);
  if (estimate) meta.push(estimate);
  if (subtaskCount && subtaskCount.total > 0) meta.push(`${subtaskCount.done}/${subtaskCount.total} steps`);
  if (task.status === 'doing') meta.push('In progress');
  if (dropped) meta.push('Dropped');

  const timing = now ? taskTiming(task, now) : { kind: 'ok' as const };
  const warning =
    timing.kind === 'overdue'
      ? `Overdue · from ${timing.since}`
      : timing.kind === 'carried'
        ? timing.carried === 1
          ? 'Carried over from an earlier day'
          : `Carried over ${timing.carried} times`
        : timing.kind === 'late'
          ? 'Time passed'
          : null;

  return (
    <View
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`task-${task.id}`}>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={done}
        aria-disabled={dropped}
        accessibilityLabel={`Done: ${task.title}`}
        disabled={dropped}
        onPress={() => void toggleTaskDone(task)}
        hitSlop={8}
        style={styles.checkHit}>
        <View
          style={[
            styles.check,
            {
              borderColor: done ? theme.accent : workspace ? colorOf(workspace.color) : theme.border,
              backgroundColor: done ? theme.accent : 'transparent',
            },
          ]}>
          {done ? (
            <Text variant="small" style={{ color: theme.onAccent, fontWeight: '700' }}>
              ✓
            </Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open task ${task.title}`}
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.flex, closed && styles.struck]}
            color={closed ? 'textMuted' : 'text'}
            numberOfLines={2}>
            {task.title}
          </Text>
          {task.mustDo && !closed ? (
            <View style={[styles.flag, { backgroundColor: theme.alertSoft }]}>
              <Text variant="label" color="alert">
                {task.critical ? 'Critical' : 'Must do'}
              </Text>
            </View>
          ) : null}
        </View>
        {warning ? (
          <Text variant="small" color="alert" numberOfLines={1}>
            {warning}
          </Text>
        ) : null}
        {meta.length > 0 ? (
          <Text variant="small" color="textMuted" numberOfLines={1}>
            {meta.join(' · ')}
          </Text>
        ) : null}
      </Pressable>
      {reorder ? (
        <View style={styles.reorder}>
          <ArrowButton label={`Move ${task.title} up`} glyph="↑" onPress={reorder.onUp} />
          <ArrowButton label={`Move ${task.title} down`} glyph="↓" onPress={reorder.onDown} />
        </View>
      ) : null}
    </View>
  );
}

function ArrowButton({ label, glyph, onPress }: { label: string; glyph: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={!onPress}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        { borderColor: theme.border, opacity: onPress ? (pressed ? 0.6 : 1) : 0.3 },
      ]}>
      <Text variant="bodyStrong" color="accent">
        {glyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  reorder: { flexDirection: 'row', gap: Spacing.xs, marginLeft: Spacing.sm },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingRight: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkHit: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, paddingVertical: Spacing.sm, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  struck: { textDecorationLine: 'line-through' },
  pressed: { opacity: 0.7 },
  flex: { flex: 1, minWidth: 0 },
});
