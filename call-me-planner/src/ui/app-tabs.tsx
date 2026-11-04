import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from './use-theme';

/** Phone tab bar (native iOS / Android tabs). The browser app uses app-tabs.web.tsx. */
export default function AppTabs() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.surface}
      indicatorColor={theme.accentSoft}
      labelStyle={{ selected: { color: theme.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="today" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tomorrow">
        <NativeTabs.Trigger.Label>Tomorrow</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sunrise', selected: 'sunrise.fill' }} md="event_upcoming" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'checkmark.circle', selected: 'checkmark.circle.fill' }}
          md="task_alt"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
