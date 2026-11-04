import { format } from 'date-fns';
import { StyleSheet, View } from 'react-native';

import { parseLocalDate, toLocalDate } from '@/domain/dates';
import { doneByDay, groupByWorkspace, weekDays, weekStart } from '@/domain/day-view';
import { useLiveQuery } from '@/stores/use-live-query';
import { useToday } from '@/stores/use-today';
import { useWorkspaces } from '@/stores/workspaces';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Screen } from '@/ui/screen';
import { TaskRow } from '@/ui/task-row';
import { Text } from '@/ui/text';
import { Spacing } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';
import { WeekChart } from '@/ui/week-chart';
import { useWorkspaceColor } from '@/ui/workspace-color';

export default function ReviewScreen() {
  const today = useToday();
  const workspaces = useWorkspaces((s) => s.items);
  const colorOf = useWorkspaceColor();
  const theme = useTheme();
  const todayDate = parseLocalDate(today)!;
  const days = weekDays(todayDate);

  const data = useLiveQuery(['task'], (r) => r.tasks.doneSince(weekStart(todayDate).toISOString()), [today]);
  const done = data.data ?? [];
  const counts = doneByDay(done, days);
  const doneToday = done.filter((t) => t.completedAt && toLocalDate(new Date(t.completedAt)) === today);
  const groups = groupByWorkspace(done, workspaces);
  const range = `${format(parseLocalDate(days[0]!)!, 'd MMM')} – ${format(parseLocalDate(days[6]!)!, 'd MMM')}`;

  return (
    <Screen title="Review" subtitle={`This week · ${range}`}>
      <Card>
        <Text variant="bodyStrong">{`${done.length} done this week · ${doneToday.length} today`}</Text>
        <WeekChart days={days} counts={counts} today={today} />
      </Card>

      {data.status === 'ready' && done.length === 0 ? (
        <EmptyState
          title="Nothing finished yet this week"
          body="Tasks you tick off show here, grouped by workspace, ready for a standup or a weekly report."
        />
      ) : null}

      {groups.map(({ workspace, tasks }) => (
        <View key={workspace?.id ?? 'none'} style={styles.group}>
          <View style={styles.header}>
            <View
              style={[
                styles.dot,
                { backgroundColor: workspace ? colorOf(workspace.color) : theme.textMuted },
              ]}
            />
            <Text variant="bodyStrong" style={styles.flex}>
              {workspace?.name ?? 'No workspace'}
            </Text>
            <Text variant="small" color="textMuted">
              {`${tasks.length} done`}
            </Text>
          </View>
          {[...tasks]
            .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
            .map((t) => (
              <TaskRow key={t.id} task={t} showDay />
            ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1, minWidth: 0 },
});
