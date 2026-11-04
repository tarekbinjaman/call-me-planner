import { EmptyState } from '@/ui/empty-state';
import { Screen } from '@/ui/screen';

export default function TomorrowScreen() {
  return (
    <Screen title="Tomorrow" subtitle="Plan tomorrow tonight, so the morning starts ready.">
      <EmptyState
        title="Tomorrow is empty"
        body="You'll be able to drag tasks here from Today or the Inbox."
      />
    </Screen>
  );
}
