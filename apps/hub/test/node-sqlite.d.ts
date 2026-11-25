// The Hub tsconfig only loads workers-types, so declare the little of node:sqlite the tests use.
declare module 'node:sqlite' {
  type SqlValue = null | number | bigint | string | Uint8Array;

  interface StatementSync {
    all(...params: SqlValue[]): unknown[];
    get(...params: SqlValue[]): unknown;
    run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
}

interface ImportMeta {
  readonly dirname: string;
}

declare module 'node:fs' {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
