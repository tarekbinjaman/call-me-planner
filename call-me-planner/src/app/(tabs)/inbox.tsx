import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { quickAddTask } from '@/data/task-actions';
import { useLiveQuery } from '@/stores/use-live-query';
import { useWorkspaces } from '@/stores/workspaces';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { QuickAdd } from '@/ui/quick-add';
import { Screen } from '@/ui/screen';
import { TaskRow } from '@/ui/task-row';
import { Text } from '@/ui/text';
import { Spacing } from '@/ui/theme';

export default function InboxScreen() {
  const workspaces = useWorkspaces((s) => s.items);
  const data = useLiveQuery(
    ['task'],
    async (r) => {
      const [inbox, someday] = await Promise.all([r.tasks.inbox(), r.tasks.someday()]);
      return { inbox, someday };
    },
    [],
  );
  const tasks = data.data?.inbox ?? [];
  const someday = data.data?.someday ?? [];

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

      {data.status === 'error' ? <Text color="alert">{`Couldn't load the Inbox: ${data.error}`}</Text> : null}

      {data.status === 'ready' && tasks.length === 0 ? (
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

      {someday.length > 0 ? (
        <View style={styles.list} testID="someday-list">
          <Text variant="label" color="textMuted">
            {`Someday · ${someday.length}`}
          </Text>
          <Text variant="small" color="textMuted">
            Tasks with a workspace but no day. Give one a day when you are ready for it.
          </Text>
          {someday.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              workspace={workspaces.find((w) => w.id === task.workspaceId)}
              showDay
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  left: { alignSelf: 'flex-start', marginTop: -Spacing.md },
});
