/**
 * Schema migrations, run in order on app open.
 *
 * SQLite stores the last applied step in `PRAGMA user_version`. Each step runs in a transaction
 * together with the version bump, so a crash halfway never leaves a half-migrated database.
 *
 * Rules:
 * - Never edit or reorder a step that has shipped. Add a new step instead.
 * - `version` must be 1, 2, 3, ... with no gaps.
 */

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'settings table',
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY NOT NULL,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

/** The few database calls the runner needs, so it can be unit tested without a real device. */
export type MigrationDb = {
  getFirstAsync<T>(sql: string): Promise<T | null>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

export type MigrationResult = {
  from: number;
  to: number;
  applied: string[];
};

export function validateMigrations(migrations: Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(`Migration "${m.name}" has version ${m.version}, expected ${i + 1}`);
    }
  });
}

export async function getUserVersion(db: MigrationDb): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function migrate(
  db: MigrationDb,
  migrations: Migration[] = MIGRATIONS,
): Promise<MigrationResult> {
  validateMigrations(migrations);
  const from = await getUserVersion(db);
  const latest = migrations.length;

  if (from > latest) {
    throw new Error(
      `Database is at version ${from} but this app only knows up to ${latest}. Update the app.`,
    );
  }

  const applied: string[] = [];
  for (const m of migrations) {
    if (m.version <= from) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      // PRAGMA can't take bound parameters; m.version is a number from this file, never user input.
      await db.execAsync(`PRAGMA user_version = ${Number(m.version)}`);
    });
    applied.push(m.name);
  }

  return { from, to: Math.max(from, latest), applied };
}
