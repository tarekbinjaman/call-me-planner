import { StyleSheet, View } from 'react-native';

import { Text } from './text';
import { Radius, Spacing, type ThemeColor } from './theme';
import { useTheme } from './use-theme';

const WORKSPACES: { name: string; color: ThemeColor }[] = [
  { name: 'Personal', color: 'wsPersonal' },
  { name: 'Company A', color: 'wsCompanyA' },
  { name: 'Company B', color: 'wsCompanyB' },
];

/** The three workspace colors. Real workspaces come from the database in Phase 1. */
export function WorkspaceChips() {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {WORKSPACES.map((ws) => (
        <View
          key={ws.name}
          style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.dot, { backgroundColor: theme[ws.color] }]} />
          <Text variant="small">{ws.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
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
