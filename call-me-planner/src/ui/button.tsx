import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'secondary', disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const look = {
    primary: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    secondary: { bg: theme.surface, fg: theme.text, border: theme.border },
    ghost: { bg: 'transparent', fg: theme.accent, border: 'transparent' },
    danger: { bg: theme.alertSoft, fg: theme.alert, border: theme.alertSoft },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={!!disabled}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: look.bg, borderColor: look.border },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.75 },
        style,
      ]}
      {...rest}>
      <Text variant="bodyStrong" style={{ color: look.fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A delete button that asks twice inside the page ("Delete" → "Tap again to delete"),
 * because system confirm dialogs don't work in the browser app.
 */
export function ConfirmDeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <Button
      variant="danger"
      label={armed ? 'Tap again to delete' : label}
      onPress={() => (armed ? onConfirm() : setArmed(true))}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
