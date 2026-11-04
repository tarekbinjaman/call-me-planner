import { useCallback } from 'react';

import type { WorkspaceColor } from '@/data/types';

import type { ThemeColors } from './theme';
import { useTheme } from './use-theme';

/** Resolves a stored workspace color: a theme token name (light/dark aware) or a hex value. */
export function resolveWorkspaceColor(theme: ThemeColors, color: WorkspaceColor): string {
  return color in theme ? theme[color as keyof ThemeColors] : color;
}

export function useWorkspaceColor() {
  const theme = useTheme();
  return useCallback((color: WorkspaceColor) => resolveWorkspaceColor(theme, color), [theme]);
}
