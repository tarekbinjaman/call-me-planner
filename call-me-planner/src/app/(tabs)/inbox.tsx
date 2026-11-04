import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { quickAddTask } from '@/data/task-actions';
import { useLiveQuery } from '@/stores/use-live-query';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { QuickAdd } from '@/ui/quick-add';
import { Screen } from '@/ui/screen';
import { TaskRow } from '@/ui/task-row';
import { Text } from '@/ui/text';
import { Spacing } from '@/ui/theme';

export default function InboxScreen() {
  const inbox = useLiveQuery(['task'], (r) => r.tasks.inbox(), []);
  const tasks = inbox.data ?? [];

  return (
    <Screen
      title="Inbox"
      subtitle="Quick ideas with no company yet. Open one to give it a workspace and a day.">
      <QuickAdd placeholder="Type a task and press Enter" onAdd={quickAddTask} />
      <Button
        label="New task with details"
        variant="ghost"
        onPress={() => router.push('/task/edit')}
        style={styles.left}
      />

      {inbox.status === 'error' ? (
        <Text color="alert">{`Couldn't load the Inbox: ${inbox.error}`}</Text>
      ) : null}

      {inbox.status === 'ready' && tasks.length === 0 ? (
        <EmptyState
          title="Inbox is clear"
          body="Anything you capture quickly lands here. Sort it into a workspace and a day later."
        />
      ) : null}

      <View style={styles.list} testID="inbox-list">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} showDay />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  left: { alignSelf: 'flex-start', marginTop: -Spacing.md },
});
