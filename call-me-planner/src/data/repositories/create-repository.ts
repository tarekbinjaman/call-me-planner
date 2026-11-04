import type { RepoDeps, SqlParam } from '../sql';
import type { BaseEntity, BaseKeys } from '../types';

/** How a field is stored: text/number as-is, bool as 0/1, json as TEXT. */
export type FieldKind = 'text' | 'number' | 'bool' | 'json';

export type FieldSpec<E> = { [K in Exclude<keyof E, BaseKeys>]-?: FieldKind };

export type RepositorySpec<E extends BaseEntity, D extends Exclude<keyof E, BaseKeys>> = {
  table: string;
  fields: FieldSpec<E>;
  /** Values used when insert() leaves a field out. Fields not listed here are required. */
  defaults: Pick<E, D>;
  /** Default ORDER BY for getAll(). Column names, trusted. */
  orderBy?: string;
};

/** Required fields + optional defaulted fields + optional id (for fixed seed ids). */
export type InsertInput<E extends BaseEntity, D extends keyof E> = Omit<E, BaseKeys | D> &
  Partial<Pick<E, D>> & { id?: string };

export type UpdatePatch<E extends BaseEntity> = Partial<Omit<E, BaseKeys>>;

export type QueryOptions = {
  /** SQL condition with ? placeholders, e.g. "status = ?". Never put user input in here directly. */
  where?: string;
  params?: SqlParam[];
  orderBy?: string;
  /** Include soft-deleted rows. Default false. */
  includeDeleted?: boolean;
};

export type Repository<E extends BaseEntity, D extends keyof E> = {
  table: string;
  getAll(options?: QueryOptions): Promise<E[]>;
  getById(id: string): Promise<E | null>;
  insert(input: InsertInput<E, D>): Promise<E>;
  update(id: string, patch: UpdatePatch<E>): Promise<E | null>;
  softDelete(id: string): Promise<void>;
  /** Undo a soft delete. */
  restore(id: string): Promise<void>;
};

const BASE_COLUMNS = ['id', 'created_at', 'updated_at', 'deleted_at'] as const;

export function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function encode(kind: FieldKind, value: unknown): SqlParam {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case 'bool':
      return value ? 1 : 0;
    case 'json':
      return JSON.stringify(value);
    case 'number':
      return Number(value);
    case 'text':
      return String(value);
  }
}

function decode(kind: FieldKind, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case 'bool':
      return value === 1 || value === true || value === '1';
    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;
    case 'number':
      return Number(value);
    case 'text':
      return String(value);
  }
}

/**
 * Builds a typed repository for one table. Column names come from the static field spec,
 * so they are safe to put in SQL; every value goes through ? parameters.
 */
export function createRepository<E extends BaseEntity, D extends Exclude<keyof E, BaseKeys>>(
  deps: RepoDeps,
  spec: RepositorySpec<E, D>,
): Repository<E, D> {
  const { db, now, newId } = deps;
  const fieldEntries = Object.entries(spec.fields) as [string, FieldKind][];
  const columns = fieldEntries.map(([key, kind]) => ({ key, kind, column: toSnakeCase(key) }));
  const allColumns = [...BASE_COLUMNS, ...columns.map((c) => c.column)];
  const selectList = allColumns.join(', ');
  const defaultOrder = spec.orderBy ?? 'created_at';

  function fromRow(row: Record<string, unknown>): E {
    const entity: Record<string, unknown> = {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
    };
    for (const c of columns) entity[c.key] = decode(c.kind, row[c.column]);
    return entity as E;
  }

  async function getById(id: string): Promise<E | null> {
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT ${selectList} FROM ${spec.table} WHERE id = ?`,
      [id],
    );
    return row ? fromRow(row) : null;
  }

  return {
    table: spec.table,

    async getAll(options = {}) {
      const conditions: string[] = [];
      if (!options.includeDeleted) conditions.push('deleted_at IS NULL');
      if (options.where) conditions.push(`(${options.where})`);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT ${selectList} FROM ${spec.table} ${where} ORDER BY ${options.orderBy ?? defaultOrder}`,
        options.params ?? [],
      );
      return rows.map(fromRow);
    },

    getById,

    async insert(input) {
      const timestamp = now();
      const values: Record<string, unknown> = { ...spec.defaults, ...input };
      const id = input.id ?? newId();
      const params: SqlParam[] = [id, timestamp, timestamp, null];
      for (const c of columns) {
        if (values[c.key] === undefined && !(c.key in spec.defaults)) {
          // Optional nullable fields may be left out; they are stored as NULL.
          params.push(null);
        } else {
          params.push(encode(c.kind, values[c.key]));
        }
      }
      const placeholders = allColumns.map(() => '?').join(', ');
      await db.runAsync(
        `INSERT INTO ${spec.table} (${allColumns.join(', ')}) VALUES (${placeholders})`,
        params,
      );
      const saved = await getById(id);
      if (!saved) throw new Error(`Insert into ${spec.table} did not save row ${id}`);
      return saved;
    },

    async update(id, patch) {
      const sets: string[] = [];
      const params: SqlParam[] = [];
      for (const c of columns) {
        if (!(c.key in patch)) continue;
        sets.push(`${c.column} = ?`);
        params.push(encode(c.kind, (patch as Record<string, unknown>)[c.key]));
      }
      sets.push('updated_at = ?');
      params.push(now(), id);
      await db.runAsync(`UPDATE ${spec.table} SET ${sets.join(', ')} WHERE id = ?`, params);
      return getById(id);
    },

    async softDelete(id) {
      const timestamp = now();
      await db.runAsync(
        `UPDATE ${spec.table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        [timestamp, timestamp, id],
      );
    },

    async restore(id) {
      await db.runAsync(
        `UPDATE ${spec.table} SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL`,
        [now(), id],
      );
    },
  };
}
