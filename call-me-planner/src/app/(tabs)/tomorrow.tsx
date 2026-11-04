import { addDays, format } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { moveTaskToDay, quickAddForDay } from '@/data/task-actions';
import type { Task } from '@/data/types';
import { parseLocalDate, toLocalDate } from '@/domain/dates';
import { describeCapacity, totalCapacity } from '@/domain/capacity';
import { groupByWorkspace } from '@/domain/day-view';
import { useLiveQuery } from '@/stores/use-live-query';
import { useToday } from '@/stores/use-today';
import { useWorkspaces } from '@/stores/workspaces';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { DayGroups } from '@/ui/day-groups';
import { EmptyState } from '@/ui/empty-state';
import { QuickAdd } from '@/ui/quick-add';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { Radius, Spacing } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';
import { useWorkspaceColor } from '@/ui/workspace-color';

export default function TomorrowScreen() {
  const today = useToday();
  const tomorrow = toLocalDate(addDays(parseLocalDate(today)!, 1));
  const workspaces = useWorkspaces((s) => s.items);
  const [reorderMode, setReorderMode] = useState(false);

  const data = useLiveQuery(
    ['task'],
    async (r) => {
      const [planned, todayOpen, inbox] = await Promise.all([
        r.tasks.onDay(tomorrow),
        r.tasks.forDay(today),
        r.tasks.inbox(),
      ]);
      // Candidates to pull into tomorrow: what's still open today, plus unscheduled Inbox ideas.
      const candidates = [...todayOpen, ...inbox.filter((t) => !t.scheduledDate)];
      return { planned, candidates };
    },
    [today, tomorrow],
  );

  const planned = data.data?.planned ?? [];
  const candidates = data.data?.candidates ?? [];
  const groups = groupByWorkspace(planned, workspaces);
  const total = totalCapacity(groups);

  return (
    <Screen title="Tomorrow" subtitle={format(parseLocalDate(tomorrow)!, 'EEEE d MMMM')}>
      {planned.length > 0 ? (
        <Card>
          <Text variant="bodyStrong">{`${planned.length} task${planned.length === 1 ? '' : 's'} planned`}</Text>
          <Text variant="small" color={total.over ? 'alert' : 'textMuted'}>
            {`Planned ${describeCapacity(total)}`}
          </Text>
        </Card>
      ) : null}

      <QuickAdd
        placeholder="Add a task for tomorrow"
        onAdd={(title) => quickAddForDay(title, tomorrow, planned.length)}
      />

      {data.status === 'ready' && planned.length === 0 ? (
        <EmptyState
          title="Tomorrow is empty"
          body="Plan it tonight: add tasks above, or pick from today's leftovers and the Inbox below."
        />
      ) : null}

      {planned.length > 1 ? (
        <Button
          label={reorderMode ? 'Done reordering' : 'Reorder'}
          variant={reorderMode ? 'primary' : 'ghost'}
          onPress={() => setReorderMode((v) => !v)}
          style={styles.left}
        />
      ) : null}

      <DayGroups groups={groups} reorderMode={reorderMode} />

      {candidates.length > 0 ? (
        <View style={styles.section}>
          <Text variant="label" color="textMuted">
            Move into tomorrow
          </Text>
          <Text variant="small" color="textMuted">
            Still open today, and Inbox ideas without a day.
          </Text>
          <View style={styles.list} testID="tomorrow-candidates">
            {candidates.map((t) => (
              <CandidateRow key={t.id} task={t} onMove={() => void moveTaskToDay(t, tomorrow, 'tomorrow')} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function CandidateRow({ task, onMove }: { task: Task; onMove: () => void }) {
  const theme = useTheme();
  const colorOf = useWorkspaceColor();
  const workspace = useWorkspaces((s) => s.items.find((w) => w.id === task.workspaceId));
  return (
    <View style={[styles.candidate, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.dot, { backgroundColor: workspace ? colorOf(workspace.color) : theme.border }]} />
      <View style={styles.flex}>
        <Text numberOfLines={2}>{task.title}</Text>
        <Text variant="small" color="textMuted">
          {`${workspace?.name ?? 'Inbox'}${task.scheduledDate ? ' · open today' : ''}`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Move ${task.title} to tomorrow`}
        onPress={onMove}
        style={({ pressed }) => [
          styles.moveButton,
          { backgroundColor: theme.accentSoft, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Text variant="small" color="accent" style={styles.bold}>
          Tomorrow →
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  left: { alignSelf: 'flex-start' },
  section: { gap: Spacing.sm },
  list: { gap: Spacing.sm },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  moveButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    justifyContent: 'center',
  },
  bold: { fontWeight: '700' },
  flex: { flex: 1, minWidth: 0 },
});
