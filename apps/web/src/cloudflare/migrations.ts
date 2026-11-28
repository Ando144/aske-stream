import type { CfApi } from './api';
import { CfError, type Migration } from './types';

const CREATE_TABLE =
  'CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)';

interface QueryResult {
  results?: Record<string, unknown>[];
}

export function pendingMigrations(applied: string[], all: Migration[]): Migration[] {
  const done = new Set(applied);
  return all.filter((m) => !done.has(m.name));
}

/** Enough for our own migrations: no triggers and no `;` inside strings. */
export function splitSql(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function addedColumn(stmt: string): { table: string; column: string } | null {
  const match = /^ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i.exec(stmt);
  return match ? { table: match[1]!, column: match[2]! } : null;
}

type Query = (sql: string, params?: string[]) => Promise<QueryResult[]>;

async function columnExists(query: Query, table: string, column: string): Promise<boolean> {
  const rows = await query(`PRAGMA table_info(${table})`);
  const wanted = column.toLowerCase();
  return (rows?.[0]?.results ?? []).some((r) => String(r.name).toLowerCase() === wanted);
}

/** A CfError stays one, because the setup screen picks its message from the code. */
function migrationError(name: string, cause: unknown): Error {
  const error =
    cause instanceof CfError ? new CfError(cause.code, cause.status, cause.cfCodes) : new Error();
  error.message = `Migration ${name} failed`;
  error.cause = cause;
  return error;
}

/**
 * Statement by statement, so a migration that stopped halfway can run again: SQLite has no
 * `ADD COLUMN IF NOT EXISTS`.
 */
async function runMigration(query: Query, migration: Migration): Promise<void> {
  try {
    for (const statement of splitSql(migration.sql)) {
      const added = addedColumn(statement);
      if (added && (await columnExists(query, added.table, added.column))) continue;
      await query(statement);
    }
  } catch (cause) {
    throw migrationError(migration.name, cause);
  }
}

export async function applyMigrations(
  api: CfApi,
  accountId: string,
  dbId: string,
  all: Migration[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const path = `/accounts/${accountId}/d1/database/${dbId}/query`;
  const query: Query = (sql, params) =>
    api.call<QueryResult[]>('POST', path, { json: params ? { sql, params } : { sql } });

  await query(CREATE_TABLE);
  const rows = await query('SELECT name FROM d1_migrations');
  const applied = (rows?.[0]?.results ?? []).map((r) => String(r.name));
  const pending = pendingMigrations(applied, all);
  onProgress?.(0, pending.length);
  for (const [i, m] of pending.entries()) {
    await runMigration(query, m);
    await query('INSERT INTO d1_migrations (name) VALUES (?)', [m.name]);
    onProgress?.(i + 1, pending.length);
  }
  return pending.length;
}
