import { describe, expect, it, vi } from 'vitest';
import { createCfApi } from '../../src/cloudflare/api';
import { applyMigrations, pendingMigrations } from '../../src/cloudflare/migrations';
import { FakeCloudflare, ok } from './fakeCloudflare';

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
});
