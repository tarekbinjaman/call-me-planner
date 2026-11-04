import { afterEach, describe, expect, it } from 'vitest';

import { syncReminders } from './reminders';
import { answerRing, markRingMissed, markRingShown, scheduleTestRing } from './ring';
import { seedIfNeeded } from './seed';
import { createTestRepos } from './testing/node-db';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const at = (h: number, m = 0, day = 4) => new Date(2026, 10, day, h, m);

/** A must-do due at 10:00 with its ladder planned at 08:00; returns the ring (+10 min) reminder. */
async function setup() {
  const t = await createTestRepos();
  cleanup = () => t.db.close();
  await seedIfNeeded(t.db, t.repos);
  const task = await t.repos.tasks.insert({
    title: 'Call bank',
    mustDo: true,
    scheduledDate: '2026-11-04',
    dueAt: at(10).toISOString(),
  });
  await syncReminders(t.repos, at(8));
  const ring = (await t.repos.reminders.getAll()).find((r) => r.channel === 'ring')!;
  return { ...t, task, ring };
}

const events = async (repos: Awaited<ReturnType<typeof setup>>['repos'], reminderId: string) =>
  (await repos.reminderEvents.getAll({ where: 'reminder_id = ?', params: [reminderId] })).map((e) => e.event);

describe('ring answers on real SQLite', () => {
  it('Done closes the task, the reminder, and cancels the rest of the ladder', async () => {
    const { repos, task, ring } = await setup();
    await markRingShown(repos, ring.id, at(10, 10));
    expect(await answerRing(repos, ring.id, 'done', at(10, 10, 4))).toBe('ok');
    expect((await repos.tasks.getById(task.id))?.status).toBe('done');
    expect((await repos.reminders.getById(ring.id))?.status).toBe('answered');
    expect(await events(repos, ring.id)).toEqual(['shown', 'done']);

    await syncReminders(repos, at(10, 11));
    const waiting = await repos.reminders.getAll({
      where: "status = 'scheduled' AND fire_at > ?",
      params: [at(10, 11).toISOString()],
    });
    expect(waiting).toEqual([]);
  });

  it('Snooze re-plans the ladder from the snooze time', async () => {
    const { repos, task, ring } = await setup();
    expect(await answerRing(repos, ring.id, 'snooze', at(10, 10))).toBe('ok');
    expect(await repos.tasks.getById(task.id)).toMatchObject({
      snoozeCount: 1,
      snoozedUntil: at(10, 20).toISOString(),
    });
    await syncReminders(repos, at(10, 11));
    const next = await repos.reminders.getAll({
      where: "status = 'scheduled' AND fire_at > ?",
      params: [at(10, 11).toISOString()],
      orderBy: 'fire_at',
    });
    expect(next.map((r) => [r.channel, new Date(r.fireAt).getMinutes()])).toEqual([
      ['ring', 20],
      ['phone_call', 30],
      ['sms_buddy', 50],
    ]);
  });

  it('refuses Snooze after the limit', async () => {
    const { repos, task, ring } = await setup();
    await repos.tasks.update(task.id, { snoozeCount: 3 });
    expect(await answerRing(repos, ring.id, 'snooze', at(10, 10))).toBe('snooze_limit');
    expect((await repos.reminders.getById(ring.id))?.status).toBe('scheduled');
  });

  it('Move to tomorrow moves the task and its ladder', async () => {
    const { repos, task, ring } = await setup();
    expect(await answerRing(repos, ring.id, 'tomorrow', at(10, 10))).toBe('ok');
    expect((await repos.tasks.getById(task.id))?.scheduledDate).toBe('2026-11-05');
    expect(await events(repos, ring.id)).toEqual(['moved']);
    await syncReminders(repos, at(10, 11));
    const next = await repos.reminders.getAll({
      where: "status = 'scheduled' AND fire_at > ?",
      params: [at(10, 11).toISOString()],
      orderBy: 'fire_at',
    });
    expect(new Date(next[0]!.fireAt).getDate()).toBe(5);
  });

  it('a second answer does nothing', async () => {
    const { repos, ring } = await setup();
    await answerRing(repos, ring.id, 'done', at(10, 10));
    expect(await answerRing(repos, ring.id, 'snooze', at(10, 10))).toBe('already_answered');
  });

  it('an ignored ring is logged as missed, once', async () => {
    const { repos, ring } = await setup();
    await markRingShown(repos, ring.id, at(10, 10));
    expect(await markRingMissed(repos, ring.id, at(10, 11))).toBe(true);
    expect(await markRingMissed(repos, ring.id, at(10, 12))).toBe(false);
    expect((await repos.reminders.getById(ring.id))?.status).toBe('missed');
    expect(await events(repos, ring.id)).toEqual(['shown', 'missed']);
    expect(await answerRing(repos, ring.id, 'done', at(10, 12))).toBe('already_answered');
  });
});

describe('test ring', () => {
  it('rings once, outside the ladder, and the reminder sync leaves it alone', async () => {
    const { repos, task } = await setup();
    const test = await scheduleTestRing(repos, task.id, 10, at(9));
    expect(test).toMatchObject({ channel: 'ring', stepIndex: -1, status: 'scheduled' });
    expect(new Date(test.fireAt).getTime() - at(9).getTime()).toBe(10_000);
    await syncReminders(repos, at(9));
    expect((await repos.reminders.getById(test.id))?.status).toBe('scheduled');
    expect(await answerRing(repos, test.id, 'snooze', at(9, 1))).toBe('ok');
  });
});
