import { describe, expect, it, vi } from 'vitest';
import { createCfApi } from '../../src/cloudflare/api';
import {
  addedColumn,
  applyMigrations,
  pendingMigrations,
  splitSql,
} from '../../src/cloudflare/migrations';
import { CfError } from '../../src/cloudflare/types';
import { fail, FakeCloudflare, ok } from './fakeCloudflare';

const ALL = [
  { name: '0001_a.sql', sql: 'CREATE TABLE a(x)' },
  { name: '0002_b.sql', sql: 'CREATE TABLE b(x)' },
  { name: '0003_c.sql', sql: 'CREATE TABLE c(x)' },
];

describe('pendingMigrations', () => {
  it('returns the ones not applied, in order', () => {
    expect(pendingMigrations(['0002_b.sql'], ALL).map((m) => m.name)).toEqual([
      '0001_a.sql',
      '0003_c.sql',
    ]);
    expect(
      pendingMigrations(
        ALL.map((m) => m.name),
        ALL,
      ),
    ).toEqual([]);
  });
});

describe('splitSql', () => {
  it('drops comment lines and splits into trimmed statements', () => {
    const sql = [
      '-- header; with a semicolon',
      'CREATE TABLE a (',
      '  -- indented comment',
      '  x TEXT',
      ');',
      '',
      '  ALTER TABLE a ADD COLUMN y TEXT;  ',
    ].join('\r\n');
    expect(splitSql(sql)).toEqual([
      'CREATE TABLE a (\n  x TEXT\n)',
      'ALTER TABLE a ADD COLUMN y TEXT',
    ]);
  });

  it('returns nothing for empty or comment-only input', () => {
    expect(splitSql('-- nothing\n ;\n;')).toEqual([]);
  });
});

describe('addedColumn', () => {
  it('reads the table and column, ignoring case and line breaks', () => {
    expect(addedColumn('ALTER TABLE tracks ADD COLUMN upload_id TEXT')).toEqual({
      table: 'tracks',
      column: 'upload_id',
    });
    expect(addedColumn('alter table Folders\n  add column pinned_at INTEGER')).toEqual({
      table: 'Folders',
      column: 'pinned_at',
    });
  });

  it.each([
    'CREATE TABLE a (x TEXT)',
    'ALTER TABLE a RENAME TO b',
    'ALTER TABLE a DROP COLUMN x',
    "INSERT INTO meta VALUES ('ALTER TABLE a ADD COLUMN x')",
  ])('ignores %s', (statement) => {
    expect(addedColumn(statement)).toBeNull();
  });
});

describe('applyMigrations', () => {
  const query = '/accounts/a1/d1/database/db1/query';

  it('creates the table, applies pending ones and records each', async () => {
    const fake = new FakeCloudflare().on(`POST ${query}`, (req) => {
      const sql = (req.json as { sql: string }).sql;
      return sql.startsWith('SELECT')
        ? ok([{ results: [{ name: '0001_a.sql' }] }])
        : ok([{ results: [] }]);
    });
    const progress = vi.fn();
    const n = await applyMigrations(createCfApi(fake.transport, 't'), 'a1', 'db1', ALL, progress);
    expect(n).toBe(2);
    const bodies = fake.requests.map((r) => r.json as { sql: string; params?: string[] });
    expect(bodies[0]!.sql).toContain('CREATE TABLE IF NOT EXISTS d1_migrations');
    expect(bodies[1]!.sql).toBe('SELECT name FROM d1_migrations');
    expect(bodies.slice(2).map((b) => b.sql)).toEqual([
      'CREATE TABLE b(x)',
      'INSERT INTO d1_migrations (name) VALUES (?)',
      'CREATE TABLE c(x)',
      'INSERT INTO d1_migrations (name) VALUES (?)',
    ]);
    expect(bodies[3]!.params).toEqual(['0002_b.sql']);
    expect(bodies[5]!.params).toEqual(['0003_c.sql']);
    expect(progress.mock.calls).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('does nothing when everything is applied', async () => {
    const fake = new FakeCloudflare().on(
      `POST ${query}`,
      ok([{ results: ALL.map((m) => ({ name: m.name })) }]),
    );
    expect(await applyMigrations(createCfApi(fake.transport, 't'), 'a1', 'db1', ALL)).toBe(0);
    expect(fake.requests).toHaveLength(2);
  });

  const HALF_APPLIED = {
    name: '0008_upload_cancels.sql',
    sql: [
      'ALTER TABLE tracks ADD COLUMN upload_id TEXT;',
      'CREATE INDEX IF NOT EXISTS idx ON tracks(upload_id);',
    ].join('\n'),
  };

  function fakeWithColumns(columns: string[]) {
    return new FakeCloudflare().on(`POST ${query}`, (req) => {
      const sql = (req.json as { sql: string }).sql;
      return sql.startsWith('PRAGMA')
        ? ok([{ results: columns.map((name) => ({ name })) }])
        : ok([{ results: [] }]);
    });
  }

  /** What was sent after creating and reading the migrations table. */
  const sentAfterSetup = (fake: FakeCloudflare) =>
    fake.requests.slice(2).map((r) => (r.json as { sql: string }).sql);

  const applyHalfApplied = (fake: FakeCloudflare) =>
    applyMigrations(createCfApi(fake.transport, 't'), 'a1', 'db1', [HALF_APPLIED]);

  it('skips a column that already exists and records the migration', async () => {
    const fake = fakeWithColumns(['id', 'Upload_ID']);
    expect(await applyHalfApplied(fake)).toBe(1);
    expect(sentAfterSetup(fake)).toEqual([
      'PRAGMA table_info(tracks)',
      'CREATE INDEX IF NOT EXISTS idx ON tracks(upload_id)',
      'INSERT INTO d1_migrations (name) VALUES (?)',
    ]);
  });

  it('adds a column that is missing', async () => {
    const fake = fakeWithColumns(['id']);
    await applyHalfApplied(fake);
    expect(sentAfterSetup(fake)).toEqual([
      'PRAGMA table_info(tracks)',
      'ALTER TABLE tracks ADD COLUMN upload_id TEXT',
      'CREATE INDEX IF NOT EXISTS idx ON tracks(upload_id)',
      'INSERT INTO d1_migrations (name) VALUES (?)',
    ]);
  });

  it('names the failing migration, keeps the cause and does not record it', async () => {
    const fake = new FakeCloudflare().on(`POST ${query}`, (req) =>
      (req.json as { sql: string }).sql.startsWith('CREATE INDEX')
        ? fail(429)
        : ok([{ results: [] }]),
    );
    const error = await applyHalfApplied(fake).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('0008_upload_cancels.sql');
    expect((error as Error).cause).toBeInstanceOf(CfError);
    // The setup screen picks its plain-language message from this code.
    expect(error).toMatchObject({ code: 'rate_limited' });
    expect(sentAfterSetup(fake).some((sql) => sql.startsWith('INSERT'))).toBe(false);
  });
});
