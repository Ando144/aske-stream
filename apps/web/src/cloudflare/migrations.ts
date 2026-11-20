import type { CfApi } from './api';
import type { Migration } from './types';

const CREATE_TABLE =
  'CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)';

interface QueryResult {
  results?: Record<string, unknown>[];
}

export function pendingMigrations(applied: string[], all: Migration[]): Migration[] {
  const done = new Set(applied);
  return all.filter((m) => !done.has(m.name));
}

export async function applyMigrations(
  api: CfApi,
  accountId: string,
  dbId: string,
  all: Migration[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const path = `/accounts/${accountId}/d1/database/${dbId}/query`;
  const query = (sql: string, params?: string[]) =>
    api.call<QueryResult[]>('POST', path, { json: params ? { sql, params } : { sql } });

  await query(CREATE_TABLE);
  const rows = await query('SELECT name FROM d1_migrations');
  const applied = (rows?.[0]?.results ?? []).map((r) => String(r.name));
  const pending = pendingMigrations(applied, all);
  onProgress?.(0, pending.length);
  for (const [i, m] of pending.entries()) {
    await query(m.sql);
    await query('INSERT INTO d1_migrations (name) VALUES (?)', [m.name]);
    onProgress?.(i + 1, pending.length);
  }
  return pending.length;
}
