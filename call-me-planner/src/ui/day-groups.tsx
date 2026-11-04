import { StyleSheet, View } from 'react-native';

import { saveOrder } from '@/data/task-actions';
import { capacityFor, describeCapacity } from '@/domain/capacity';
import { reorder, type TaskGroup } from '@/domain/day-view';

import { ProgressBar } from './progress-bar';
import { TaskRow } from './task-row';
import { Text } from './text';
import { Spacing } from './theme';
import { useTheme } from './use-theme';
import { useWorkspaceColor } from './workspace-color';

/** Tasks of one day, one section per workspace, each with its hour budget bar. */
export function DayGroups({
  groups,
  now,
  reorderMode = false,
}: {
  groups: TaskGroup[];
  now?: Date;
  reorderMode?: boolean;
}) {
  const theme = useTheme();
  const colorOf = useWorkspaceColor();

  return (
    <View style={styles.groups}>
      {groups.map(({ workspace, tasks }) => {
        const capacity = workspace ? capacityFor(tasks, workspace.dailyCapacityMin) : null;
        const color = workspace ? colorOf(workspace.color) : theme.textMuted;
        const move = (from: number, to: number) => void saveOrder(reorder(tasks, from, to));
        return (
          <View
            key={workspace?.id ?? 'none'}
            style={styles.group}
            testID={`group-${workspace?.id ?? 'none'}`}>
            <View style={styles.header}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text variant="bodyStrong" style={styles.flex}>
                {workspace?.name ?? 'No workspace yet'}
              </Text>
              {capacity ? (
                <Text variant="small" color={capacity.over ? 'alert' : 'textMuted'}>
                  {describeCapacity(capacity)}
                </Text>
              ) : (
                <Text variant="small" color="textMuted">
                  {`${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
                </Text>
              )}
            </View>
            {capacity ? (
              <ProgressBar
                ratio={Math.min(1, capacity.ratio)}
                color={capacity.over ? theme.alert : color}
                label={`${workspace?.name}: ${describeCapacity(capacity)}`}
              />
            ) : null}
            {capacity?.over ? (
              <Text variant="small" color="alert">
                {`More than your ${workspace?.name} hours for this day. Move or shorten something.`}
              </Text>
            ) : null}
            <View style={styles.list}>
              {tasks.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  now={now}
                  reorder={
                    reorderMode
                      ? {
                          onUp: index > 0 ? () => move(index, index - 1) : undefined,
                          onDown: index < tasks.length - 1 ? () => move(index, index + 1) : undefined,
                        }
                      : undefined
                  }
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: Spacing.xl },
  group: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  list: { gap: Spacing.sm, marginTop: Spacing.xs },
  flex: { flex: 1, minWidth: 120 },
});
