import { afterEach, describe, expect, it } from 'vitest';

import { syncReminders } from './reminders';
import { SEED_IDS, seedIfNeeded } from './seed';
import { createTestRepos } from './testing/node-db';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const at = (h: number, m = 0, day = 4) => new Date(2026, 10, day, h, m);

async function setup() {
  const t = await createTestRepos();
  cleanup = () => t.db.close();
  await seedIfNeeded(t.db, t.repos);
  return t;
}

async function waiting(repos: Awaited<ReturnType<typeof setup>>['repos']) {
  const rows = await repos.reminders.getAll({ where: "status = 'scheduled'" });
  return rows.map((r) => [r.channel, new Date(r.fireAt).getHours(), new Date(r.fireAt).getMinutes()]);
}

describe('syncReminders on real SQLite', () => {
  it('creates the ladder for a must-do and nothing twice', async () => {
    const { repos } = await setup();
    await repos.tasks.insert({
      title: 'Call bank',
      workspaceId: SEED_IDS.companyA,
      mustDo: true,
      dueAt: at(10).toISOString(),
    });
    expect(await syncReminders(repos, at(8))).toEqual({ inserted: 5, cancelled: 0 });
    expect(await syncReminders(repos, at(8))).toEqual({ inserted: 0, cancelled: 0 });
    expect((await waiting(repos))[2]).toEqual(['ring', 10, 10]);
  });

  it('moves reminders when the time changes', async () => {
    const { repos } = await setup();
    const t = await repos.tasks.insert({ title: 'Call bank', mustDo: true, dueAt: at(10).toISOString() });
    await syncReminders(repos, at(8));
    await repos.tasks.update(t.id, { dueAt: at(15).toISOString() });
    expect(await syncReminders(repos, at(8))).toEqual({ inserted: 5, cancelled: 5 });
    expect((await waiting(repos))[0]).toEqual(['heads_up', 14, 45]);
  });

  it('cancels everything when the task is done, deleted or loses its time', async () => {
    const { repos } = await setup();
    const a = await repos.tasks.insert({ title: 'A', mustDo: true, dueAt: at(10).toISOString() });
    const b = await repos.tasks.insert({ title: 'B', dueAt: at(11).toISOString() });
    const c = await repos.tasks.insert({ title: 'C', dueAt: at(12).toISOString() });
    await syncReminders(repos, at(8));
    expect(await waiting(repos)).toHaveLength(7);

    await repos.tasks.update(a.id, { status: 'done' });
    await repos.tasks.softDelete(b.id);
    await repos.tasks.update(c.id, { dueAt: null });
    expect(await syncReminders(repos, at(8))).toEqual({ inserted: 0, cancelled: 7 });
    expect(await waiting(repos)).toEqual([]);
  });

  it('leaves reminders whose time has passed for the alarm code', async () => {
    const { repos } = await setup();
    const t = await repos.tasks.insert({ title: 'A', mustDo: true, dueAt: at(10).toISOString() });
    await syncReminders(repos, at(8));
    await repos.tasks.update(t.id, { status: 'done' });
    // At 10:15 the first three steps are in the past; only the last two get cancelled.
    expect(await syncReminders(repos, at(10, 15))).toEqual({ inserted: 0, cancelled: 2 });
  });

  it('uses a workspace policy over the default one', async () => {
    const { repos } = await setup();
    await repos.reminderPolicies.insert({
      workspaceId: SEED_IDS.personal,
      steps: [{ offsetMin: 0, channel: 'ring' }],
    });
    await repos.tasks.insert({
      title: 'Pills',
      workspaceId: SEED_IDS.personal,
      mustDo: true,
      dueAt: at(9).toISOString(),
    });
    await syncReminders(repos, at(8));
    expect(await waiting(repos)).toEqual([['ring', 9, 0]]);
  });
});
