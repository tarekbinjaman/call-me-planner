import { EmptyState } from '@/ui/empty-state';
import { Screen } from '@/ui/screen';

export default function InboxScreen() {
  return (
    <Screen title="Inbox" subtitle="Quick ideas with no date or company yet.">
      <EmptyState
        title="Inbox is clear"
        body="Anything you capture quickly lands here. Sort it into a workspace and a day later."
      />
    </Screen>
  );
}
