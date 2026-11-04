import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { getRepos } from '@/data';
import { formatShortDate } from '@/domain/dates';
import { describeProgress, planProgress } from '@/domain/progress';
import { useLiveQuery } from '@/stores/use-live-query';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { ProgressBar } from '@/ui/progress-bar';
import { QuickAdd } from '@/ui/quick-add';
import { Screen } from '@/ui/screen';
import { PlanStatusPill } from '@/ui/status-pill';
import { TaskRow } from '@/ui/task-row';
import { Text } from '@/ui/text';
import { Spacing } from '@/ui/theme';
import { useWorkspaceColor } from '@/ui/workspace-color';

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorOf = useWorkspaceColor();

  const data = useLiveQuery(
    ['plan', 'task', 'workspace'],
    async (r) => {
      const plan = await r.plans.getById(id);
      if (!plan || plan.deletedAt) return null;
      const workspace = await r.workspaces.getById(plan.workspaceId);
      const tasks = await r.tasks.getAll({
        where: 'plan_id = ? AND parent_id IS NULL',
        params: [id],
        orderBy: "CASE WHEN status IN ('done', 'dropped') THEN 1 ELSE 0 END, sort_order, created_at",
      });
      return { plan, workspace, tasks };
    },
    [id],
  );

  if (data.status === 'ready' && !data.data) {
    return (
      <Screen kind="stack" title="Plan not found">
        <EmptyState title="This plan doesn't exist" body="It may have been deleted." />
      </Screen>
    );
  }

  const plan = data.data?.plan;
  const tasks = data.data?.tasks ?? [];
  const progress = planProgress(tasks);
  const color = data.data?.workspace ? colorOf(data.data.workspace.color) : undefined;

  async function addTask(title: string) {
    if (!plan) return;
    const repos = await getRepos();
    await repos.tasks.insert({
      title,
      planId: plan.id,
      workspaceId: plan.workspaceId,
      sortOrder: tasks.length,
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: plan?.name ?? 'Plan' }} />
      <Screen
        kind="stack"
        title={plan?.name ?? ''}
        subtitle={data.data?.workspace?.name}
        headerRight={
          <Button
            label="Edit"
            variant="ghost"
            onPress={() => router.push({ pathname: '/plan/edit', params: { id } })}
          />
        }>
        {plan ? (
          <Card>
            <View style={styles.row}>
              <PlanStatusPill status={plan.status} />
              {plan.targetDate ? (
                <Text variant="small" color="textMuted">
                  {`Target ${formatShortDate(plan.targetDate)}`}
                </Text>
              ) : null}
            </View>
            {plan.goal ? <Text>{plan.goal}</Text> : null}
            <ProgressBar ratio={progress.ratio} color={color} label={describeProgress(progress)} />
            <Text variant="small" color="textMuted">
              {describeProgress(progress)}
            </Text>
          </Card>
        ) : null}

        <QuickAdd placeholder="Add a task to this plan" onAdd={addTask} />

        {data.status === 'ready' && tasks.length === 0 ? (
          <EmptyState title="No tasks in this plan" body="Add the first step above." />
        ) : null}

        <View style={styles.list}>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} showDay />
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  list: { gap: Spacing.sm },
});
