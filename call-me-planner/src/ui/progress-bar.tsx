import { StyleSheet, View } from 'react-native';

import { Radius } from './theme';
import { useTheme } from './use-theme';

/** Thin progress bar. `color` defaults to the accent; pass a workspace color to tint it. */
export function ProgressBar({ ratio, color, label }: { ratio: number; color?: string; label: string }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color ?? theme.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
