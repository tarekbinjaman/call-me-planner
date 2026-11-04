import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { useDatabaseStore } from '@/stores/database-store';
import AppTabs from '@/ui/app-tabs';
import { Colors } from '@/ui/theme';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const openDatabase = useDatabaseStore((s) => s.open);

  useEffect(() => {
    void openDatabase();
  }, [openDatabase]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: Colors[scheme].background,
      card: Colors[scheme].surface,
      text: Colors[scheme].text,
      border: Colors[scheme].border,
      primary: Colors[scheme].accent,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <AppTabs />
    </ThemeProvider>
  );
}
