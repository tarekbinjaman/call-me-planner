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
  children?: ReactNode;
};

/** Standard screen frame: title, optional subtitle, scrolling content column. */
export function Screen({ title, subtitle, children }: ScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.header}>
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
          </View>
          {children}
          <DatabaseBadge />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.xl, paddingTop: Spacing.xl },
  header: { gap: Spacing.xs },
});
