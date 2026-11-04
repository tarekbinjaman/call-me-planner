import { randomUUID } from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { notifyTableChanged } from './changes';
import { openDatabase } from './db';
import type { MigrationResult } from './migrations';
import { createRepositories, type Repositories } from './repositories';
import { seedIfNeeded } from './seed';
import type { RepoDeps, SqlDb, SqlParam } from './sql';

/** expo-sqlite's methods are overloaded, so map them onto our small SqlDb interface explicitly. */
function toSqlDb(db: SQLite.SQLiteDatabase): SqlDb {
  return {
    getAllAsync: <T>(sql: string, params: SqlParam[] = []) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T>(sql: string, params: SqlParam[] = []) => db.getFirstAsync<T>(sql, params),
    runAsync: (sql: string, params: SqlParam[] = []) => db.runAsync(sql, params),
    execAsync: (sql: string) => db.execAsync(sql),
    withTransactionAsync: (task: () => Promise<void>) => db.withTransactionAsync(task),
  };
}

type DataLayer = { repos: Repositories; migration: MigrationResult; seeded: boolean };

let initializing: Promise<DataLayer> | null = null;
let changeSubscription: { remove(): void } | null = null;

/**
 * Opens the database, runs migrations, builds the repositories, seeds first-launch data
 * and starts forwarding SQLite change events to the stores. Safe to call many times.
 */
export function initData(): Promise<DataLayer> {
  if (!initializing) {
    initializing = (async () => {
      const { db: expoDb, migration } = await openDatabase();
      const db = toSqlDb(expoDb);
      const deps: RepoDeps = {
        db,
        now: () => new Date().toISOString(),
        newId: () => randomUUID(),
      };
      const repos = createRepositories(deps);
      const seeded = await seedIfNeeded(db, repos);

      changeSubscription ??= SQLite.addDatabaseChangeListener((event) => {
        notifyTableChanged(event.tableName);
      });

      return { repos, migration, seeded };
    })().catch((error: unknown) => {
      initializing = null;
      throw error;
    });
  }
  return initializing;
}

/** Repositories for screens' actions (insert, update, ...). Waits for the database if needed. */
export async function getRepos(): Promise<Repositories> {
  return (await initData()).repos;
}
