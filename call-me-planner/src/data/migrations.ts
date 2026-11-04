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
  {
    version: 2,
    name: 'phase 1 tables',
    // Conventions for every synced table:
    // - id: UUID made on the device (or a fixed id for seeded rows, so two devices never duplicate them)
    // - created_at / updated_at: ISO timestamps (UTC); deleted_at set = soft-deleted
    // - booleans are INTEGER 0/1, JSON values are TEXT
    // - dates without time (scheduled_date, target_date) are local 'YYYY-MM-DD'
    // No FOREIGN KEY constraints on purpose: sync can deliver a task before its workspace.
    sql: `
      CREATE TABLE workspace (
        id                  TEXT PRIMARY KEY NOT NULL,
        name                TEXT NOT NULL,
        kind                TEXT NOT NULL CHECK (kind IN ('personal', 'company')),
        color               TEXT NOT NULL,
        daily_capacity_min  INTEGER NOT NULL DEFAULT 240,
        work_hours          TEXT,
        sort_order          REAL NOT NULL DEFAULT 0,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        deleted_at          TEXT
      );

      CREATE TABLE plan (
        id            TEXT PRIMARY KEY NOT NULL,
        workspace_id  TEXT NOT NULL,
        name          TEXT NOT NULL,
        goal          TEXT,
        status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done')),
        target_date   TEXT,
        sort_order    REAL NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        deleted_at    TEXT
      );
      CREATE INDEX plan_workspace ON plan (workspace_id);

      CREATE TABLE task (
        id              TEXT PRIMARY KEY NOT NULL,
        workspace_id    TEXT,
        plan_id         TEXT,
        parent_id       TEXT,
        title           TEXT NOT NULL,
        notes           TEXT,
        status          TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'dropped')),
        priority        INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
        must_do         INTEGER NOT NULL DEFAULT 0,
        critical        INTEGER NOT NULL DEFAULT 0,
        scheduled_date  TEXT,
        due_at          TEXT,
        estimate_min    INTEGER,
        carry_count     INTEGER NOT NULL DEFAULT 0,
        snooze_count    INTEGER NOT NULL DEFAULT 0,
        sort_order      REAL NOT NULL DEFAULT 0,
        completed_at    TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT
      );
      CREATE INDEX task_day ON task (scheduled_date, status);
      CREATE INDEX task_workspace ON task (workspace_id);
      CREATE INDEX task_plan ON task (plan_id);
      CREATE INDEX task_parent ON task (parent_id);

      CREATE TABLE recording (
        id          TEXT PRIMARY KEY NOT NULL,
        task_id     TEXT NOT NULL,
        uri         TEXT NOT NULL,
        duration_s  REAL NOT NULL,
        transcript  TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );
      CREATE INDEX recording_task ON recording (task_id);

      CREATE TABLE reminder_policy (
        id            TEXT PRIMARY KEY NOT NULL,
        workspace_id  TEXT,
        steps         TEXT NOT NULL,
        max_snoozes   INTEGER NOT NULL DEFAULT 3,
        quiet_start   TEXT NOT NULL DEFAULT '22:00',
        quiet_end     TEXT NOT NULL DEFAULT '07:00',
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        deleted_at    TEXT
      );

      CREATE TABLE reminder (
        id           TEXT PRIMARY KEY NOT NULL,
        task_id      TEXT NOT NULL,
        step_index   INTEGER NOT NULL,
        channel      TEXT NOT NULL CHECK (channel IN ('heads_up', 'voice', 'ring', 'phone_call', 'sms_buddy')),
        fire_at      TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'fired', 'answered', 'missed', 'cancelled')),
        external_id  TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        deleted_at   TEXT
      );
      CREATE INDEX reminder_due ON reminder (fire_at, status);
      CREATE INDEX reminder_task ON reminder (task_id);

      CREATE TABLE reminder_event (
        id           TEXT PRIMARY KEY NOT NULL,
        reminder_id  TEXT NOT NULL,
        event        TEXT NOT NULL,
        at           TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        deleted_at   TEXT
      );
      CREATE INDEX reminder_event_reminder ON reminder_event (reminder_id);

      CREATE TABLE daily_note (
        id            TEXT PRIMARY KEY NOT NULL,
        date          TEXT NOT NULL,
        workspace_id  TEXT,
        wins          TEXT,
        blockers      TEXT,
        notes         TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        deleted_at    TEXT
      );
      CREATE INDEX daily_note_date ON daily_note (date);
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
