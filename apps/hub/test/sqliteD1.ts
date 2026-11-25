/// <reference path="./node-sqlite.d.ts" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type Param = null | number | string;

/** D1 binds numbers, strings and null: booleans become 0/1 and undefined becomes null. */
function toParam(value: unknown): Param {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value as Param;
}

class SqliteStatement {
  private params: Param[] = [];

  constructor(
    private readonly db: DatabaseSync,
    readonly sql: string,
  ) {}

  bind(...args: unknown[]): this {
    this.params = args.map(toParam);
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.params) as T[] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const res = this.db.prepare(this.sql).run(...this.params);
    return { meta: { changes: Number(res.changes) } };
  }
}

/** The part of D1Database that the Hub repositories use, backed by a real SQLite in memory. */
export class SqliteD1 {
  constructor(private readonly db: DatabaseSync) {}

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(this.db, sql);
  }

  /** All statements succeed or none does, like a D1 batch. */
  async batch(statements: SqliteStatement[]): Promise<Array<{ meta: { changes: number } }>> {
    this.db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** Direct SQL for assertions about what is stored. */
  rows<T>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...params.map(toParam)) as T[];
  }
}

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

/** A fresh in-memory database with every Hub migration applied in order. */
export function createTestD1(): SqliteD1 {
  const db = new DatabaseSync(':memory:');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  return new SqliteD1(db);
}
