/**
 * The database calls the data layer uses. expo-sqlite's SQLiteDatabase fits this shape;
 * unit tests plug in Node's built-in SQLite instead, so repositories run against real SQL.
 */
export type SqlParam = string | number | null;

export type SqlDb = {
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  runAsync(sql: string, params?: SqlParam[]): Promise<unknown>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

/** What every repository needs: a database, a clock and an id maker (all swappable in tests). */
export type RepoDeps = {
  db: SqlDb;
  now: () => string;
  newId: () => string;
};
