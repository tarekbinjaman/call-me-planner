import { EmptyState } from '@/ui/empty-state';
import { Screen } from '@/ui/screen';
import { WorkspaceChips } from '@/ui/workspace-chips';

export default function TodayScreen() {
  return (
    <Screen title="Today" subtitle="Everything planned for today, from all three areas.">
      <WorkspaceChips />
      <EmptyState
        title="Nothing planned for today"
        body="Tasks you add will show here, grouped by Personal, Company A and Company B. Adding tasks comes in Phase 1."
      />
    </Screen>
  );
}
