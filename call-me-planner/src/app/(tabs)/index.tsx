import { format } from 'date-fns';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { quickAddForDay } from '@/data/task-actions';
import { parseLocalDate } from '@/domain/dates';
import { describeCapacity, groupByWorkspace, taskTiming, totalCapacity } from '@/domain/day-view';
import { useLiveQuery } from '@/stores/use-live-query';
import { useNow, useToday } from '@/stores/use-today';
import { useWorkspaces } from '@/stores/workspaces';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { DayGroups } from '@/ui/day-groups';
import { EmptyState } from '@/ui/empty-state';
import { QuickAdd } from '@/ui/quick-add';
import { Screen } from '@/ui/screen';
import { TaskRow } from '@/ui/task-row';
import { Text } from '@/ui/text';
import { Spacing } from '@/ui/theme';
import { WorkspaceChips } from '@/ui/workspace-chips';

export default function TodayScreen() {
  const today = useToday();
  const now = useNow();
  const workspaces = useWorkspaces((s) => s.items);
  const [reorderMode, setReorderMode] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const data = useLiveQuery(
    ['task'],
    async (r) => {
      const startOfToday = parseLocalDate(today)!.toISOString();
      const [open, done] = await Promise.all([r.tasks.forDay(today), r.tasks.doneSince(startOfToday)]);
      return { open, done };
    },
    [today],
  );

  const open = data.data?.open ?? [];
  const done = data.data?.done ?? [];
  const groups = groupByWorkspace(open, workspaces);
  const total = totalCapacity(groups);
  const overdue = open.filter((t) => {
    const kind = taskTiming(t, now).kind;
    return kind === 'overdue' || kind === 'carried';
  }).length;
  const dateLabel = format(parseLocalDate(today)!, 'EEEE d MMMM');

  return (
    <Screen title="Today" subtitle={dateLabel}>
      <WorkspaceChips />

      {open.length > 0 ? (
        <Card>
          <Text variant="bodyStrong">
            {`${open.length} task${open.length === 1 ? '' : 's'} to do${overdue ? ` · ${overdue} overdue` : ''}`}
          </Text>
          <Text variant="small" color={total.over ? 'alert' : 'textMuted'}>
            {`Planned ${describeCapacity(total)}`}
          </Text>
        </Card>
      ) : null}

      <QuickAdd
        placeholder="Add a task for today"
        onAdd={(title) => quickAddForDay(title, today, open.length)}
      />

      {data.status === 'error' ? <Text color="alert">{`Couldn't load today: ${data.error}`}</Text> : null}

      {data.status === 'ready' && open.length === 0 ? (
        <EmptyState
          title={done.length ? 'All done for today' : 'Nothing planned for today'}
          body={
            done.length
              ? `You finished ${done.length} task${done.length === 1 ? '' : 's'}. Plan tomorrow from the Tomorrow tab.`
              : 'Add a task above, or move tasks here from the Inbox or Tomorrow.'
          }
        />
      ) : null}

      {open.length > 1 ? (
        <Button
          label={reorderMode ? 'Done reordering' : 'Reorder'}
          variant={reorderMode ? 'primary' : 'ghost'}
          onPress={() => setReorderMode((v) => !v)}
          style={styles.left}
        />
      ) : null}

      <DayGroups groups={groups} now={now} reorderMode={reorderMode} />

      {done.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="label" color="textMuted">
              {`Done today · ${done.length}`}
            </Text>
            <Button
              label={showDone ? 'Hide' : 'Show'}
              variant="ghost"
              onPress={() => setShowDone((v) => !v)}
            />
          </View>
          {showDone
            ? done.map((t) => (
                <TaskRow key={t.id} task={t} workspace={workspaces.find((w) => w.id === t.workspaceId)} />
              ))
            : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  left: { alignSelf: 'flex-start' },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
