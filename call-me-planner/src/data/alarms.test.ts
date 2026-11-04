import { afterEach, describe, expect, it } from 'vitest';

import type { AlarmScheduler, AlarmToArm } from '@/domain/alarms';

import { armAlarms } from './alarms';
import { syncReminders } from './reminders';
import { seedIfNeeded } from './seed';
import { createTestRepos } from './testing/node-db';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const at = (h: number, m = 0, day = 4) => new Date(2026, 10, day, h, m);

function fakeScheduler(kind: AlarmScheduler['kind'] = 'in-app') {
  const map = new Map<string, AlarmToArm>();
  const scheduler: AlarmScheduler = {
    kind,
    schedule: async (r) => void map.set(r.id, r),
    cancel: async (id) => void map.delete(id),
    cancelAllForTask: async (taskId) => {
      for (const [id, r] of map) if (r.taskId === taskId) map.delete(id);
    },
    armed: async () => [...map.values()],
    stopRinging: () => {},
  };
  return { scheduler, channels: () => [...map.values()].map((r) => r.channel).sort() };
}

async function setup() {
  const t = await createTestRepos();
  cleanup = () => t.db.close();
  await seedIfNeeded(t.db, t.repos);
  return t;
}

describe('armAlarms on real SQLite', () => {
  it('arms the phone steps of a must-do, not the server ones', async () => {
    const { repos } = await setup();
    await repos.tasks.insert({ title: 'A', mustDo: true, dueAt: at(10).toISOString() });
    await syncReminders(repos, at(8));
    const { scheduler, channels } = fakeScheduler();
    expect(await armAlarms(repos, scheduler, at(8))).toEqual({ armed: 3, disarmed: 0 });
    expect(channels()).toEqual(['heads_up', 'ring', 'voice']);
    expect(await armAlarms(repos, scheduler, at(8))).toEqual({ armed: 0, disarmed: 0 });
  });

  it('disarms everything when the task is done', async () => {
    const { repos } = await setup();
    const t = await repos.tasks.insert({ title: 'A', mustDo: true, dueAt: at(10).toISOString() });
    await syncReminders(repos, at(8));
    const { scheduler, channels } = fakeScheduler();
    await armAlarms(repos, scheduler, at(8));
    await repos.tasks.update(t.id, { status: 'done' });
    await syncReminders(repos, at(8));
    expect(await armAlarms(repos, scheduler, at(8))).toEqual({ armed: 0, disarmed: 3 });
    expect(channels()).toEqual([]);
  });

  it('re-arms at the new time when the task moves', async () => {
    const { repos } = await setup();
    const t = await repos.tasks.insert({ title: 'A', mustDo: true, dueAt: at(10).toISOString() });
    await syncReminders(repos, at(8));
    const { scheduler } = fakeScheduler();
    await armAlarms(repos, scheduler, at(8));
    await repos.tasks.update(t.id, { dueAt: at(15).toISOString() });
    await syncReminders(repos, at(8));
    expect(await armAlarms(repos, scheduler, at(8))).toEqual({ armed: 3, disarmed: 3 });
    const ring = (await scheduler.armed()).find((a) => new Date(a.fireAt).getHours() === 15);
    expect(ring).toBeDefined();
  });

  it('the browser arms nothing', async () => {
    const { repos } = await setup();
    await repos.tasks.insert({ title: 'A', mustDo: true, dueAt: at(10).toISOString() });
    await syncReminders(repos, at(8));
    const { scheduler } = fakeScheduler('none');
    expect(await armAlarms(repos, scheduler, at(8))).toEqual({ armed: 0, disarmed: 0 });
  });
});
