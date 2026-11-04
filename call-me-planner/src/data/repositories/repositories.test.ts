import { afterEach, describe, expect, it } from 'vitest';

import { LATEST_VERSION } from '../migrations';
import { DEFAULT_REMINDER_STEPS, SEED_IDS, seedIfNeeded } from '../seed';
import { createTestRepos } from '../testing/node-db';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

async function setup() {
  const t = await createTestRepos();
  cleanup = () => t.db.close();
  return t;
}

describe('migrations on real SQLite', () => {
  it('creates every Phase 1 table', async () => {
    const { db } = await setup();
    const rows = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      [],
    );
    expect(rows.map((r) => r.name)).toEqual([
      'daily_note',
      'plan',
      'recording',
      'reminder',
      'reminder_event',
      'reminder_policy',
      'settings',
      'task',
      'workspace',
    ]);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(version?.user_version).toBe(LATEST_VERSION);
  });
});

describe('repository basics (tasks)', () => {
  it('inserts with defaults, ids and timestamps', async () => {
    const { repos } = await setup();
    const task = await repos.tasks.insert({ title: 'Send March invoice' });
    expect(task).toMatchObject({
      id: 'id-1',
      title: 'Send March invoice',
      status: 'todo',
      priority: 3,
      mustDo: false,
      critical: false,
      workspaceId: null,
      carryCount: 0,
      createdAt: '2026-11-04T09:00:00.000Z',
      updatedAt: '2026-11-04T09:00:00.000Z',
      deletedAt: null,
    });
  });

  it('round-trips booleans and nulls', async () => {
    const { repos } = await setup();
    const task = await repos.tasks.insert({ title: 'Call bank', mustDo: true, estimateMin: 15 });
    const loaded = await repos.tasks.getById(task.id);
    expect(loaded?.mustDo).toBe(true);
    expect(loaded?.critical).toBe(false);
    expect(loaded?.estimateMin).toBe(15);
    expect(loaded?.dueAt).toBeNull();
  });

  it('updates only the given fields and bumps updated_at', async () => {
    const { repos, tick } = await setup();
    const task = await repos.tasks.insert({ title: 'Draft report', notes: 'v1' });
    tick(60_000);
    const updated = await repos.tasks.update(task.id, { status: 'done', mustDo: true });
    expect(updated).toMatchObject({ title: 'Draft report', notes: 'v1', status: 'done', mustDo: true });
    expect(updated?.updatedAt).toBe('2026-11-04T09:01:00.000Z');
    expect(updated?.createdAt).toBe('2026-11-04T09:00:00.000Z');
  });

  it('soft delete hides the row but keeps it', async () => {
    const { repos } = await setup();
    const a = await repos.tasks.insert({ title: 'Keep' });
    const b = await repos.tasks.insert({ title: 'Remove' });
    await repos.tasks.softDelete(b.id);
    expect((await repos.tasks.getAll()).map((t) => t.id)).toEqual([a.id]);
    const all = await repos.tasks.getAll({ includeDeleted: true });
    expect(all).toHaveLength(2);
    expect((await repos.tasks.getById(b.id))?.deletedAt).not.toBeNull();
  });

  it('rejects values the schema does not allow', async () => {
    const { repos } = await setup();
    await expect(repos.tasks.insert({ title: 'Bad', priority: 9 as never })).rejects.toThrow();
  });

  it('treats quotes in values as plain text', async () => {
    const { repos } = await setup();
    const title = "Robert'); DROP TABLE task;--";
    const task = await repos.tasks.insert({ title });
    expect((await repos.tasks.getById(task.id))?.title).toBe(title);
    expect(await repos.tasks.getAll()).toHaveLength(1);
  });
});

describe('task queries', () => {
  it('forDay returns open tasks scheduled today or earlier', async () => {
    const { repos } = await setup();
    await repos.tasks.insert({ title: 'Yesterday open', scheduledDate: '2026-11-03' });
    await repos.tasks.insert({ title: 'Today', scheduledDate: '2026-11-04', status: 'doing' });
    await repos.tasks.insert({ title: 'Tomorrow', scheduledDate: '2026-11-05' });
    await repos.tasks.insert({ title: 'Done today', scheduledDate: '2026-11-04', status: 'done' });
    await repos.tasks.insert({ title: 'No date' });
    await repos.tasks.insert({ title: 'Subtask', scheduledDate: '2026-11-04', parentId: 'x' });
    const titles = (await repos.tasks.forDay('2026-11-04')).map((t) => t.title);
    expect(titles.sort()).toEqual(['Today', 'Yesterday open']);
    expect((await repos.tasks.onDay('2026-11-05')).map((t) => t.title)).toEqual(['Tomorrow']);
  });

  it('inbox leaves out subtasks', async () => {
    const { repos } = await setup();
    const parent = await repos.tasks.insert({ title: 'Parent idea' });
    await repos.tasks.insert({ title: 'Child step', parentId: parent.id });
    expect((await repos.tasks.inbox()).map((t) => t.title)).toEqual(['Parent idea']);
    expect((await repos.tasks.subtasks(parent.id)).map((t) => t.title)).toEqual(['Child step']);
  });

  it('restore undoes a soft delete', async () => {
    const { repos } = await setup();
    const t = await repos.tasks.insert({ title: 'Oops' });
    await repos.tasks.softDelete(t.id);
    await repos.tasks.restore(t.id);
    expect((await repos.tasks.getById(t.id))?.deletedAt).toBeNull();
    expect(await repos.tasks.getAll()).toHaveLength(1);
  });

  it('inbox returns open tasks without a workspace, newest first', async () => {
    const { repos, tick } = await setup();
    await repos.tasks.insert({ title: 'Old idea' });
    tick();
    await repos.tasks.insert({ title: 'New idea' });
    await repos.tasks.insert({ title: 'Filed', workspaceId: 'ws-personal' });
    expect((await repos.tasks.inbox()).map((t) => t.title)).toEqual(['New idea', 'Old idea']);
  });
});

describe('json fields and settings', () => {
  it('stores workspace work hours as JSON', async () => {
    const { repos } = await setup();
    const ws = await repos.workspaces.insert({
      name: 'Company A',
      kind: 'company',
      color: 'wsCompanyA',
      workHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '13:00' },
    });
    expect((await repos.workspaces.getById(ws.id))?.workHours).toEqual({
      days: [1, 2, 3, 4, 5],
      start: '09:00',
      end: '13:00',
    });
  });

  it('settings get and set (upsert)', async () => {
    const { repos } = await setup();
    expect(await repos.settings.get('x')).toBeNull();
    await repos.settings.set('x', { a: 1 });
    await repos.settings.set('x', { a: 2 });
    expect(await repos.settings.get('x')).toEqual({ a: 2 });
  });
});

describe('seedIfNeeded', () => {
  it('creates the three workspaces and the default reminder policy', async () => {
    const { db, repos } = await setup();
    expect(await seedIfNeeded(db, repos)).toBe(true);
    const workspaces = await repos.workspaces.getAll();
    expect(workspaces.map((w) => [w.id, w.name, w.kind, w.dailyCapacityMin])).toEqual([
      [SEED_IDS.personal, 'Personal', 'personal', 120],
      [SEED_IDS.companyA, 'Company A', 'company', 240],
      [SEED_IDS.companyB, 'Company B', 'company', 240],
    ]);
    const policy = await repos.reminderPolicies.getById(SEED_IDS.defaultPolicy);
    expect(policy).toMatchObject({
      workspaceId: null,
      steps: DEFAULT_REMINDER_STEPS,
      maxSnoozes: 3,
      quietStart: '22:00',
      quietEnd: '07:00',
    });
  });

  it('runs only once', async () => {
    const { db, repos } = await setup();
    await seedIfNeeded(db, repos);
    expect(await seedIfNeeded(db, repos)).toBe(false);
    expect(await repos.workspaces.getAll()).toHaveLength(3);
  });

  it('keeps a renamed workspace when seeding again after the seed flag is lost', async () => {
    const { db, repos } = await setup();
    await seedIfNeeded(db, repos);
    await repos.workspaces.update(SEED_IDS.companyA, { name: 'Acme Ltd' });
    await db.runAsync('DELETE FROM settings', []);
    await seedIfNeeded(db, repos);
    const names = (await repos.workspaces.getAll()).map((w) => w.name);
    expect(names).toEqual(['Personal', 'Acme Ltd', 'Company B']);
  });
});
