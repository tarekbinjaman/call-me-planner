import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DatabaseBadge } from './database-badge';
import { Text } from './text';
import { MaxContentWidth, Spacing } from './theme';
import { useTheme } from './use-theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  /** Extra content next to the title (e.g. an Edit button). */
  headerRight?: ReactNode;
  /**
   * 'tab' = top-level tab screen (draws its own big title, clears the status bar).
   * 'stack' = pushed or modal screen under the navigation header.
   */
  kind?: 'tab' | 'stack';
  children?: ReactNode;
};

/** Standard screen frame: title, optional subtitle, scrolling content column. */
export function Screen({ title, subtitle, headerRight, kind = 'tab', children }: ScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={kind === 'tab' ? ['top', 'left', 'right'] : ['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.column, kind === 'stack' && styles.stackColumn]}>
          <View style={styles.headerRow}>
            <View style={styles.header}>
              <Text variant={kind === 'tab' ? 'title' : 'heading'} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
            </View>
            {headerRight}
          </View>
          {children}
          {kind === 'tab' ? <DatabaseBadge /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.xl, paddingTop: Spacing.xl },
  stackColumn: { paddingTop: Spacing.lg, gap: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  header: { gap: Spacing.xs, flex: 1, minWidth: 0 },
});
