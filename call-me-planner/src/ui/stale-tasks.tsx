import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Task } from '@/data/types';
import { answerStaleTask } from '@/data/task-actions';
import { STALE_CHOICES, type StaleChoice } from '@/domain/stale';

import { Button } from './button';
import { Card } from './card';
import { Text } from './text';
import { Spacing } from './theme';
import { useTheme } from './use-theme';

/**
 * Shown on Today for tasks that keep rolling over (3 times or more):
 * do it today, break it into smaller steps, park it for someday, or drop it.
 */
export function StaleTasks({ tasks }: { tasks: Task[] }) {
  const theme = useTheme();
  if (tasks.length === 0) return null;

  const answer = (task: Task, choice: StaleChoice) => {
    void answerStaleTask(task, choice);
    if (choice === 'breakDown') router.push({ pathname: '/task/[id]', params: { id: task.id } });
  };

  return (
    <Card style={{ borderColor: theme.alert }} testID="stale-tasks">
      <Text variant="bodyStrong">
        {tasks.length === 1 ? 'This task keeps slipping' : `${tasks.length} tasks keep slipping`}
      </Text>
      <Text variant="small" color="textMuted">
        Moved to a new day 3 times or more. Decide what happens to it.
      </Text>
      {tasks.map((task) => (
        <View key={task.id} style={[styles.item, { borderTopColor: theme.border }]}>
          <Text variant="bodyStrong">{task.title}</Text>
          <Text variant="small" color="alert">{`Carried over ${task.carryCount} times`}</Text>
          <View style={styles.choices}>
            {STALE_CHOICES.map((c) => (
              <Button
                key={c.value}
                label={c.label}
                variant={c.value === 'today' ? 'primary' : c.value === 'drop' ? 'danger' : 'secondary'}
                accessibilityLabel={`${c.label}: ${task.title}`}
                onPress={() => answer(task, c.value)}
              />
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { gap: Spacing.xs, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
});
