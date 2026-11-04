import type { Repositories } from './repositories';
import type { SqlDb } from './sql';
import type { ReminderStep } from './types';

/**
 * First-launch data. Ids are fixed so that two devices that both seed (before sync exists)
 * end up with the same rows instead of duplicates.
 */
export const SEED_IDS = {
  personal: 'ws-personal',
  companyA: 'ws-company-a',
  companyB: 'ws-company-b',
  defaultPolicy: 'policy-default',
} as const;

/** Decision D5: −15, 0, +10, +20, +40 minutes. */
export const DEFAULT_REMINDER_STEPS: ReminderStep[] = [
  { offsetMin: -15, channel: 'heads_up' },
  { offsetMin: 0, channel: 'voice' },
  { offsetMin: 10, channel: 'ring' },
  { offsetMin: 20, channel: 'phone_call' },
  { offsetMin: 40, channel: 'sms_buddy' },
];

const SEED_VERSION = 1;
const SEED_KEY = 'seed_version';

export async function seedIfNeeded(db: SqlDb, repos: Repositories): Promise<boolean> {
  const done = (await repos.settings.get<number>(SEED_KEY)) ?? 0;
  if (done >= SEED_VERSION) return false;

  await db.withTransactionAsync(async () => {
    const workspaces = [
      { id: SEED_IDS.personal, name: 'Personal', kind: 'personal', color: 'wsPersonal', capacity: 120 },
      { id: SEED_IDS.companyA, name: 'Company A', kind: 'company', color: 'wsCompanyA', capacity: 240 },
      { id: SEED_IDS.companyB, name: 'Company B', kind: 'company', color: 'wsCompanyB', capacity: 240 },
    ] as const;

    for (const [index, ws] of workspaces.entries()) {
      if (await repos.workspaces.getById(ws.id)) continue;
      await repos.workspaces.insert({
        id: ws.id,
        name: ws.name,
        kind: ws.kind,
        color: ws.color,
        dailyCapacityMin: ws.capacity,
        sortOrder: index,
      });
    }

    if (!(await repos.reminderPolicies.getById(SEED_IDS.defaultPolicy))) {
      // Decision D6: quiet hours 22:00–07:00. Max 3 snoozes.
      await repos.reminderPolicies.insert({
        id: SEED_IDS.defaultPolicy,
        steps: DEFAULT_REMINDER_STEPS,
        maxSnoozes: 3,
        quietStart: '22:00',
        quietEnd: '07:00',
      });
    }

    await repos.settings.set(SEED_KEY, SEED_VERSION);
  });
  return true;
}
