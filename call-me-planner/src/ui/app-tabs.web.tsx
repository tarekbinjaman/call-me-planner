import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Text } from './text';
import { MaxContentWidth, Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

/** Browser app navigation: a top bar with the same four sections as the phone tabs. */
export default function AppTabs() {
  return (
    <Tabs>
      <TabList asChild>
        <TopBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Today</TabButton>
          </TabTrigger>
          <TabTrigger name="tomorrow" href="/tomorrow" asChild>
            <TabButton>Tomorrow</TabButton>
          </TabTrigger>
          <TabTrigger name="inbox" href="/inbox" asChild>
            <TabButton>Inbox</TabButton>
          </TabTrigger>
          <TabTrigger name="review" href="/review" asChild>
            <TabButton>Review</TabButton>
          </TabTrigger>
        </TopBar>
      </TabList>
      <TabSlot style={{ flex: 1 }} />
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable
      // TabTrigger's slot ref is typed for View; Pressable renders a View, so this is safe.
      {...(props as PressableProps)}
      style={({ pressed }) => [
        styles.tab,
        { backgroundColor: isFocused ? theme.accentSoft : 'transparent' },
        pressed && styles.pressed,
      ]}>
      <Text variant="bodyStrong" color={isFocused ? 'accent' : 'textMuted'}>
        {children}
      </Text>
    </Pressable>
  );
}

function TopBar(props: TabListProps) {
  const theme = useTheme();
  return (
    <View
      {...props}
      style={[styles.bar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <View style={styles.inner}>
        <Text variant="heading" style={styles.brand}>
          Call-Me Planner
        </Text>
        <View style={styles.tabs}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.lg },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  brand: { marginRight: 'auto' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tab: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  pressed: { opacity: 0.7 },
});
