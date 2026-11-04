import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useWorkspaces } from '@/stores/workspaces';

import { Text } from './text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';
import { useWorkspaceColor } from './workspace-color';

function formatHours(minutes: number) {
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`;
}

/** Your workspaces, read from the local database, with each one's daily hour budget. */
export function WorkspaceChips() {
  const theme = useTheme();
  const workspaces = useWorkspaces((s) => s.items);
  const colorOf = useWorkspaceColor();

  return (
    <View style={styles.row} testID="workspace-chips">
      {workspaces.map((ws) => (
        <Pressable
          key={ws.id}
          accessibilityRole="link"
          accessibilityLabel={`${ws.name}, ${formatHours(ws.dailyCapacityMin)} a day. Open workspace`}
          onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: ws.id } })}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <View style={[styles.dot, { backgroundColor: colorOf(ws.color) }]} />
          <Text variant="small">{ws.name}</Text>
          <Text variant="small" color="textMuted">
            {formatHours(ws.dailyCapacityMin)}
          </Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/workspace/edit')}
        style={({ pressed }) => [styles.chip, { borderColor: theme.border }, pressed && styles.pressed]}>
        <Text variant="small" color="accent">
          + Workspace
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pressed: { opacity: 0.7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
