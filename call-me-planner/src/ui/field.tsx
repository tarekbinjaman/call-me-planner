import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './text';
import { Radius, Spacing, Type } from './theme';
import { useTheme } from './use-theme';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

/** Label + control + hint or error message. */
export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="small" color="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function TextField({ invalid, style, ...rest }: TextInputProps & { invalid?: boolean }) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textMuted}
      style={[
        styles.input,
        Type.body,
        {
          color: theme.text,
          backgroundColor: theme.surface,
          borderColor: invalid ? theme.alert : theme.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
