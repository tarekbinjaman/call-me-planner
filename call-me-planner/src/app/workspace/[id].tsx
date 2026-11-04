import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Plan, PlanStatus } from '@/data/types';
import { describeWorkHours, formatShortDate } from '@/domain/dates';
import { describeProgress, planProgress, type Progress } from '@/domain/progress';
import { useLiveQuery } from '@/stores/use-live-query';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { ProgressBar } from '@/ui/progress-bar';
import { Screen } from '@/ui/screen';
import { PlanStatusPill } from '@/ui/status-pill';
import { Text } from '@/ui/text';
import { Spacing } from '@/ui/theme';
import { useWorkspaceColor } from '@/ui/workspace-color';

type PlanWithProgress = { plan: Plan; progress: Progress };

const SECTIONS: { status: PlanStatus; title: string }[] = [
  { status: 'active', title: 'Active plans' },
  { status: 'paused', title: 'Paused' },
  { status: 'done', title: 'Done' },
];

export default function WorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorOf = useWorkspaceColor();
  const [showDone, setShowDone] = useState(false);

  const workspace = useLiveQuery(['workspace'], (r) => r.workspaces.getById(id), [id]);
  const plans = useLiveQuery<PlanWithProgress[]>(
    ['plan', 'task'],
    async (r) => {
      const list = await r.plans.getAll({ where: 'workspace_id = ?', params: [id] });
      const tasks = await r.tasks.getAll({
        where: 'plan_id IN (SELECT id FROM plan WHERE workspace_id = ?)',
        params: [id],
      });
      return list.map((plan) => ({
        plan,
        progress: planProgress(tasks.filter((t) => t.planId === plan.id)),
      }));
    },
    [id],
  );

  const ws = workspace.data;
  if (workspace.status === 'ready' && !ws) {
    return (
      <Screen kind="stack" title="Workspace not found">
        <EmptyState title="This workspace doesn't exist" body="It may have been deleted on another device." />
      </Screen>
    );
  }

  const color = ws ? colorOf(ws.color) : undefined;
  const items = plans.data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: ws?.name ?? 'Workspace' }} />
      <Screen
        kind="stack"
        title={ws?.name ?? ''}
        subtitle={
          ws
            ? `${ws.kind === 'company' ? 'Company' : 'Personal'} · ${ws.dailyCapacityMin / 60} h a day · ${describeWorkHours(ws.workHours)}`
            : undefined
        }
        headerRight={
          <Button
            label="Edit"
            variant="ghost"
            onPress={() => router.push({ pathname: '/workspace/edit', params: { id } })}
          />
        }>
        <View style={[styles.colorBar, { backgroundColor: color }]} />

        <Button
          label="New plan"
          variant="primary"
          onPress={() => router.push({ pathname: '/plan/edit', params: { workspaceId: id } })}
        />

        {plans.status === 'ready' && items.length === 0 ? (
          <EmptyState
            title="No plans yet"
            body="A plan groups tasks toward one goal, like “Launch the new website”. Add one to track its progress."
          />
        ) : null}

        {SECTIONS.map(({ status, title }) => {
          const inSection = items.filter((i) => i.plan.status === status);
          if (inSection.length === 0) return null;
          const collapsed = status === 'done' && !showDone;
          return (
            <View key={status} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text variant="label" color="textMuted">
                  {`${title} · ${inSection.length}`}
                </Text>
                {status === 'done' ? (
                  <Button
                    variant="ghost"
                    label={showDone ? 'Hide' : 'Show'}
                    onPress={() => setShowDone((v) => !v)}
                  />
                ) : null}
              </View>
              {collapsed
                ? null
                : inSection.map(({ plan, progress }) => (
                    <PlanCard key={plan.id} plan={plan} progress={progress} color={color} />
                  ))}
            </View>
          );
        })}
      </Screen>
    </>
  );
}

function PlanCard({ plan, progress, color }: { plan: Plan; progress: Progress; color?: string }) {
  const text = describeProgress(progress);
  return (
    <Card
      accessibilityLabel={`${plan.name}, ${text}`}
      onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}>
      <View style={styles.cardTop}>
        <Text variant="bodyStrong" style={styles.flex}>
          {plan.name}
        </Text>
        <PlanStatusPill status={plan.status} />
      </View>
      {plan.goal ? (
        <Text variant="small" color="textMuted" numberOfLines={2}>
          {plan.goal}
        </Text>
      ) : null}
      <ProgressBar ratio={progress.ratio} color={color} label={text} />
      <View style={styles.cardTop}>
        <Text variant="small" color="textMuted" style={styles.flex}>
          {text}
        </Text>
        {plan.targetDate ? (
          <Text variant="small" color="textMuted">
            {`Target ${formatShortDate(plan.targetDate)}`}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  colorBar: { height: 4, borderRadius: 2, marginTop: -Spacing.sm },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1, minWidth: 0 },
});
