import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

type Option<T> = { value: T; label: string };

/** A row of toggle chips. Single choice by default; `multiple` allows several. */
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  multiple = false,
  accessibilityLabel,
}: {
  options: readonly Option<T>[];
  value: T | T[];
  onChange: (value: T | T[]) => void;
  multiple?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const selected = Array.isArray(value) ? value : [value];

  function press(option: T) {
    if (!multiple) return onChange(option);
    const next = selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option];
    onChange(next);
  }

  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            onPress={() => press(o.value)}
            style={[
              styles.chip,
              {
                backgroundColor: on ? theme.accentSoft : theme.surface,
                borderColor: on ? theme.accent : theme.border,
              },
            ]}>
            <Text variant="small" color={on ? 'accent' : 'text'} style={on && styles.bold}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  bold: { fontWeight: '700' },
});
