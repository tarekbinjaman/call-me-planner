import { describe, expect, it } from 'vitest';

import { LATEST_VERSION, MIGRATIONS, migrate, type Migration, type MigrationDb } from './migrations';

/** In-memory stand-in for expo-sqlite that records executed SQL and tracks user_version. */
function fakeDb(startVersion = 0, failOn?: string) {
  let version = startVersion;
  const executed: string[] = [];
  const db: MigrationDb = {
    async getFirstAsync<T>() {
      return { user_version: version } as T;
    },
    async execAsync(sql) {
      if (failOn && sql.includes(failOn)) throw new Error('boom');
      const match = /PRAGMA user_version = (\d+)/.exec(sql);
      if (match) version = Number(match[1]);
      else executed.push(sql.trim());
    },
    async withTransactionAsync(task) {
      const before = version;
      try {
        await task();
      } catch (e) {
        version = before; // rollback
        throw e;
      }
    },
  };
  return { db, executed, version: () => version };
}

const steps: Migration[] = [
  { version: 1, name: 'one', sql: 'CREATE TABLE a (id TEXT);' },
  { version: 2, name: 'two', sql: 'CREATE TABLE b (id TEXT);' },
];

describe('migrate', () => {
  it('runs every step on a fresh database', async () => {
    const f = fakeDb();
    const result = await migrate(f.db, steps);
    expect(result).toEqual({ from: 0, to: 2, applied: ['one', 'two'] });
    expect(f.version()).toBe(2);
  });

  it('only runs steps newer than user_version', async () => {
    const f = fakeDb(1);
    const result = await migrate(f.db, steps);
    expect(result.applied).toEqual(['two']);
    expect(f.executed).toEqual(['CREATE TABLE b (id TEXT);']);
  });

  it('does nothing when already up to date', async () => {
    const f = fakeDb(2);
    const result = await migrate(f.db, steps);
    expect(result.applied).toEqual([]);
    expect(f.executed).toEqual([]);
  });

  it('is safe to run twice', async () => {
    const f = fakeDb();
    await migrate(f.db, steps);
    const second = await migrate(f.db, steps);
    expect(second.applied).toEqual([]);
    expect(f.version()).toBe(2);
  });

  it('keeps the old version when a step fails', async () => {
    const f = fakeDb(0, 'TABLE b');
    await expect(migrate(f.db, steps)).rejects.toThrow('boom');
    expect(f.version()).toBe(1);
  });

  it('refuses a database newer than the app', async () => {
    const f = fakeDb(5);
    await expect(migrate(f.db, steps)).rejects.toThrow(/only knows up to 2/);
  });

  it('rejects gaps in version numbers', async () => {
    const f = fakeDb();
    const bad: Migration[] = [{ version: 2, name: 'gap', sql: '' }];
    await expect(migrate(f.db, bad)).rejects.toThrow(/expected 1/);
  });
});

describe('MIGRATIONS', () => {
  it('starts at version 1 for Phase 0', () => {
    expect(MIGRATIONS[0]?.version).toBe(1);
    expect(LATEST_VERSION).toBeGreaterThanOrEqual(1);
  });
});
