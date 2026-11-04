import { Pressable, StyleSheet, View } from 'react-native';

import { useDatabaseStore } from '@/stores/database-store';

import { Text } from './text';
import { Fonts, Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

/** Small status line at the bottom of each screen so you can see the local database is working. */
export function DatabaseBadge() {
  const theme = useTheme();
  const state = useDatabaseStore((s) => s.state);
  const open = useDatabaseStore((s) => s.open);

  if (state.status === 'error') {
    return (
      <View style={[styles.box, { backgroundColor: theme.alertSoft }]}>
        <Text variant="small" color="alert">
          {`The local database couldn't open: ${state.message}`}
        </Text>
        <Pressable accessibilityRole="button" onPress={open}>
          <Text variant="bodyStrong" color="alert">
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  const label =
    state.status === 'opening' ? 'Opening database…' : `Database ready · schema v${state.version}`;
  return (
    <Text variant="small" color="textMuted" style={styles.mono} testID="database-status">
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  mono: { fontFamily: Fonts.mono, fontSize: 12 },
});
