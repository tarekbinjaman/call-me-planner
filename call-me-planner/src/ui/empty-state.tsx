import { StyleSheet, View } from 'react-native';

import { Text } from './text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text variant="bodyStrong">{title}</Text>
      <Text color="textMuted">{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
});
