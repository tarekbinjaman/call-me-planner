import { afterEach, describe, expect, it } from 'vitest';

import { rolloverTasks, runRollover } from './rollover';
import { createTestRepos } from './testing/node-db';

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

describe('rolloverTasks on real SQLite', () => {
  it('moves yesterday’s open tasks onto today and shows them in Today', async () => {
    const { repos } = await setup();
    const late = await repos.tasks.insert({ title: 'Call bank', scheduledDate: '2026-11-03' });
    const done = await repos.tasks.insert({
      title: 'Paid rent',
      scheduledDate: '2026-11-03',
      status: 'done',
    });
    const later = await repos.tasks.insert({ title: 'Dentist', scheduledDate: '2026-11-06' });

    expect(await rolloverTasks(repos, '2026-11-04')).toBe(1);

    expect(await repos.tasks.getById(late.id)).toMatchObject({ scheduledDate: '2026-11-04', carryCount: 1 });
    expect(await repos.tasks.getById(done.id)).toMatchObject({ scheduledDate: '2026-11-03', carryCount: 0 });
    expect(await repos.tasks.getById(later.id)).toMatchObject({ scheduledDate: '2026-11-06', carryCount: 0 });
    expect((await repos.tasks.onDay('2026-11-04')).map((t) => t.id)).toEqual([late.id]);
  });

  it('running twice the same day changes nothing the second time', async () => {
    const { repos } = await setup();
    const t = await repos.tasks.insert({ title: 'Call bank', scheduledDate: '2026-11-01' });
    await rolloverTasks(repos, '2026-11-04');
    expect(await rolloverTasks(repos, '2026-11-04')).toBe(0);
    expect((await repos.tasks.getById(t.id))?.carryCount).toBe(1);
  });

  it('skips soft-deleted tasks', async () => {
    const { repos } = await setup();
    const t = await repos.tasks.insert({ title: 'Old idea', scheduledDate: '2026-11-01' });
    await repos.tasks.softDelete(t.id);
    expect(await rolloverTasks(repos, '2026-11-04')).toBe(0);
  });

  it('shares one run when asked twice at once, so the carry is counted once', async () => {
    const { repos } = await setup();
    const t = await repos.tasks.insert({ title: 'Call bank', scheduledDate: '2026-11-03' });
    const [a, b] = await Promise.all([runRollover(repos, '2026-11-04'), runRollover(repos, '2026-11-04')]);
    expect([a, b]).toEqual([1, 1]);
    expect((await repos.tasks.getById(t.id))?.carryCount).toBe(1);
  });
});
