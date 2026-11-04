import { Platform } from 'react-native';

/**
 * Design tokens. Every color in the app comes from here, in a light and a dark version.
 * Workspace colors identify Personal / Company A / Company B everywhere (chips, dots, capacity bars).
 */
export const Colors = {
  light: {
    background: '#F5F7F6',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF2F0',
    border: '#D9E1DE',
    text: '#14201D',
    textMuted: '#5A6B66',
    accent: '#0F7B5F', // "answer call" green: primary actions, Done
    accentSoft: '#E2F2EC',
    alert: '#C2410C', // overdue, missed ring
    alertSoft: '#FBE9E1',
    wsPersonal: '#7C4DDB',
    wsCompanyA: '#2563EB',
    wsCompanyB: '#B7791F',
    wsTeal: '#0E7C86',
    wsRose: '#C0365A',
    wsSlate: '#4B5D73',
    onAccent: '#FFFFFF',
  },
  dark: {
    background: '#0F1614',
    surface: '#16201D',
    surfaceMuted: '#1C2824',
    border: '#2A3833',
    text: '#E4ECE9',
    textMuted: '#97A8A2',
    accent: '#3CC79A',
    accentSoft: '#163A2F',
    alert: '#F08A5D',
    alertSoft: '#3A2219',
    wsPersonal: '#A98BF0',
    wsCompanyA: '#6EA0FF',
    wsCompanyB: '#E0AE5A',
    wsTeal: '#4CC3CC',
    wsRose: '#F07A98',
    wsSlate: '#9AAAC0',
    onAccent: '#04140F',
  },
} as const;

/** Colors a workspace can use, in picker order. */
export const WORKSPACE_COLORS = [
  'wsPersonal',
  'wsCompanyA',
  'wsCompanyB',
  'wsTeal',
  'wsRose',
  'wsSlate',
] as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof ThemeColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/** Type scale. Sizes are in points; line heights keep body text comfortable to read. */
export const Type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
} as const;

export const Fonts = {
  mono: Platform.select({
    ios: 'ui-monospace',
    web: 'ui-monospace, Consolas, monospace',
    default: 'monospace',
  }),
};

/** Widest content column on tablets and in the browser app. */
export const MaxContentWidth = 880;
