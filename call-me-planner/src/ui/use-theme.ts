import { useColorScheme } from 'react-native';

import { Colors, type ThemeColors } from './theme';

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
