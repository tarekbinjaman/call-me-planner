import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUndo } from '@/stores/undo';

import { Text } from './text';
import { MaxContentWidth, Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

/** Bottom toast with an Undo button. Mounted once in the root layout. */
export function UndoToast() {
  const toast = useUndo((s) => s.toast);
  const runUndo = useUndo((s) => s.runUndo);
  const dismiss = useUndo((s) => s.dismiss);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 88 }]}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: theme.text }]}
        testID="undo-toast">
        <Text style={[styles.message, { color: theme.background }]}>{toast.message}</Text>
        {toast.undo ? (
          <Pressable accessibilityRole="button" onPress={() => void runUndo()} style={styles.action}>
            <Text variant="bodyStrong" style={{ color: theme.accentSoft }}>
              Undo
            </Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => dismiss()} style={styles.action}>
            <Text variant="bodyStrong" style={{ color: theme.accentSoft }}>
              OK
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: MaxContentWidth - Spacing.lg * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  message: { flex: 1, minWidth: 0 },
  action: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
});
