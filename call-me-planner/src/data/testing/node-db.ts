/// <reference types="node" />
// Test-only: a real in-memory SQLite (Node's built-in node:sqlite) behind the SqlDb interface,
// so repository tests exercise the actual SQL and migrations. Never imported by the app.
import { DatabaseSync } from 'node:sqlite';

import { migrate } from '../migrations';
import { createRepositories } from '../repositories';
import type { RepoDeps, SqlDb, SqlParam } from '../sql';

export function createNodeDb(): SqlDb & { close(): void } {
  const raw = new DatabaseSync(':memory:');
  const plain = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : null);

  return {
    async getAllAsync<T>(sql: string, params: SqlParam[] = []) {
      return raw
        .prepare(sql)
        .all(...params)
        .map((row: unknown) => plain<T>(row) as T);
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[] = []) {
      return plain<T>(raw.prepare(sql).get(...params));
    },
    async runAsync(sql: string, params: SqlParam[] = []) {
      return raw.prepare(sql).run(...params);
    },
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      raw.close();
    },
  };
}

/** Fresh migrated database + repositories with a controllable clock and predictable ids. */
export async function createTestRepos(start = '2026-11-04T09:00:00.000Z') {
  const db = createNodeDb();
  await migrate(db);
  let clock = new Date(start).getTime();
  let counter = 0;
  const deps: RepoDeps = {
    db,
    now: () => new Date(clock).toISOString(),
    newId: () => `id-${++counter}`,
  };
  return {
    db,
    deps,
    repos: createRepositories(deps),
    /** Move the clock forward by `ms` milliseconds. */
    tick(ms = 1000) {
      clock += ms;
    },
  };
}
