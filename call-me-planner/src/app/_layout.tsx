import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { useDatabaseStore } from '@/stores/database-store';
import { useRollover } from '@/stores/use-rollover';
import { Colors } from '@/ui/theme';
import { UndoToast } from '@/ui/undo-toast';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const openDatabase = useDatabaseStore((s) => s.open);

  useEffect(() => {
    void openDatabase();
  }, [openDatabase]);

  useRollover();

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
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors[scheme].surface },
          headerTintColor: Colors[scheme].accent,
          headerTitleStyle: { color: Colors[scheme].text },
          contentStyle: { backgroundColor: Colors[scheme].background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workspace/[id]" options={{ title: 'Workspace' }} />
        <Stack.Screen name="plan/[id]" options={{ title: 'Plan' }} />
        <Stack.Screen name="workspace/edit" options={{ presentation: 'modal', title: 'Workspace' }} />
        <Stack.Screen name="plan/edit" options={{ presentation: 'modal', title: 'Plan' }} />
        <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
        <Stack.Screen name="task/edit" options={{ presentation: 'modal', title: 'Task' }} />
      </Stack>
      <UndoToast />
    </ThemeProvider>
  );
}
