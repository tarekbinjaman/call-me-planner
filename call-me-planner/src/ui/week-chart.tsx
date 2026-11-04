import { format } from 'date-fns';
import { StyleSheet, View } from 'react-native';

import { parseLocalDate } from '@/domain/dates';

import { Text } from './text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

/**
 * Seven bars, Monday to Sunday: tasks finished per day. Built from plain views
 * (works the same on phone and web); every bar is labelled with its count.
 */
export function WeekChart({ days, counts, today }: { days: string[]; counts: number[]; today: string }) {
  const theme = useTheme();
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const summary = days.map((d, i) => `${format(parseLocalDate(d)!, 'EEEE')}: ${counts[i] ?? 0}`).join(', ');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Tasks done this week, ${total} in total. ${summary}`}
      style={styles.chart}>
      {days.map((day, i) => {
        const count = counts[i] ?? 0;
        const isToday = day === today;
        const future = day > today;
        return (
          <View key={day} style={styles.column}>
            <Text variant="small" color={count ? 'text' : 'textMuted'} style={styles.count}>
              {future ? '' : String(count)}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${(count / max) * 100}%`,
                    backgroundColor: isToday ? theme.accent : theme.wsSlate,
                  },
                ]}
              />
            </View>
            <Text variant="label" color={isToday ? 'accent' : 'textMuted'}>
              {format(parseLocalDate(day)!, 'EEEEE')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', gap: Spacing.sm, height: 140, alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center', gap: Spacing.xs, height: '100%' },
  count: { fontVariant: ['tabular-nums'] },
  track: {
    flex: 1,
    width: '100%',
    maxWidth: 28,
    borderRadius: Radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: Radius.sm },
});
