import type { RepoDeps } from '../sql';

/** Simple key/value settings (stored as JSON text). */
export function createSettingsRepository({ db, now }: RepoDeps) {
  return {
    async get<T>(key: string): Promise<T | null> {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
        key,
      ]);
      return row ? (JSON.parse(row.value) as T) : null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      await db.runAsync(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, JSON.stringify(value), now()],
      );
    },
  };
}
