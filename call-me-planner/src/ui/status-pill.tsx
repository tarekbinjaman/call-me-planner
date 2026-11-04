import { StyleSheet, View } from 'react-native';

import type { PlanStatus } from '@/data/types';

import { Text } from './text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

const LABELS: Record<PlanStatus, string> = { active: 'Active', paused: 'Paused', done: 'Done' };

export function PlanStatusPill({ status }: { status: PlanStatus }) {
  const theme = useTheme();
  const look = {
    active: { bg: theme.accentSoft, fg: theme.accent },
    paused: { bg: theme.surfaceMuted, fg: theme.textMuted },
    done: { bg: theme.surfaceMuted, fg: theme.text },
  }[status];
  return (
    <View style={[styles.pill, { backgroundColor: look.bg }]}>
      <Text variant="label" style={{ color: look.fg }}>
        {LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
});
