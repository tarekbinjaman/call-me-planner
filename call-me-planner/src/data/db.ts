import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { migrate, type MigrationResult } from './migrations';

export const DATABASE_NAME = 'call-me-planner.db';

let opening: Promise<{ db: SQLite.SQLiteDatabase; migration: MigrationResult }> | null = null;

/**
 * Opens the local database once per app run and brings its schema up to date.
 * Repositories call `getDb()`; screens never touch SQLite directly.
 * The change listener is enabled so stores can reload after any write or sync.
 */
export function openDatabase() {
  if (!opening) {
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true });
      // WAL needs shared memory, which the browser's WebAssembly SQLite doesn't have.
      if (Platform.OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      const migration = await migrate(db);
      return { db, migration };
    })().catch((error: unknown) => {
      opening = null; // allow a retry
      throw error;
    });
  }
  return opening;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  return (await openDatabase()).db;
}
