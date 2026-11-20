interface ListRow {
  id: string;
  name: string;
  songs_json: string;
  delete_key_hash: string;
  created_at: number;
  expires_at: number;
}

/** Minimal in-memory D1 that understands only the statements the Hub routes use. */
export class FakeD1 {
  lists = new Map<string, ListRow>();
  limits = new Map<string, { window_start: number; count: number }>();

  prepare(sql: string) {
    return {
      bind: (...args: unknown[]) => ({
        first: async <T>() => this.first(sql, args) as T | null,
        run: async () => ({ meta: { changes: this.run(sql, args) } }),
      }),
    };
  }

  private first(sql: string, args: unknown[]): unknown {
    if (sql.includes('INSERT INTO rate_limits')) {
      const [key, windowStart] = args as [string, number];
      const row = this.limits.get(key);
      const next =
        row && row.window_start >= windowStart
          ? { window_start: windowStart, count: row.count + 1 }
          : { window_start: windowStart, count: 1 };
      this.limits.set(key, next);
      return { count: next.count };
    }
    if (sql.includes('SELECT * FROM shared_lists'))
      return this.lists.get(args[0] as string) ?? null;
    throw new Error(`Unsupported first(): ${sql}`);
  }

  private run(sql: string, args: unknown[]): number {
    if (sql.includes('INSERT INTO shared_lists')) {
      const [id, name, songs_json, delete_key_hash, created_at, expires_at] = args as [
        string,
        string,
        string,
        string,
        number,
        number,
      ];
      if (this.lists.has(id)) return 0;
      this.lists.set(id, { id, name, songs_json, delete_key_hash, created_at, expires_at });
      return 1;
    }
    if (sql.includes('DELETE FROM shared_lists'))
      return this.lists.delete(args[0] as string) ? 1 : 0;
    throw new Error(`Unsupported run(): ${sql}`);
  }
}
