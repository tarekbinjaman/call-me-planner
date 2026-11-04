import { Text as RNText, type TextProps } from 'react-native';

import { Type, type ThemeColor } from './theme';
import { useTheme } from './use-theme';

export type AppTextProps = TextProps & {
  variant?: keyof typeof Type;
  color?: ThemeColor;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  return <RNText style={[Type[variant], { color: theme[color] }, style]} {...rest} />;
}
