import { EmptyState } from '@/ui/empty-state';
import { Screen } from '@/ui/screen';

export default function ReviewScreen() {
  return (
    <Screen title="Review" subtitle="What you finished today and this week, by workspace.">
      <EmptyState
        title="Nothing finished yet"
        body="Done tasks will be listed here, ready to copy into a standup or a weekly report."
      />
    </Screen>
  );
}
