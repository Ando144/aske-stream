import { beforeEach, describe, expect, it, vi } from 'vitest';

interface OpenOptions {
  upgrade: (db: FakeDb, oldVersion: number) => void;
  blocking: () => void;
}
interface FakeDb {
  close: ReturnType<typeof vi.fn>;
  createObjectStore: ReturnType<typeof vi.fn>;
}

const state = vi.hoisted(() => {
  const s = {
    options: null as unknown,
    dbs: [] as unknown[],
    openDB: null as unknown as ReturnType<typeof vi.fn>,
  };
  s.openDB = vi.fn((_name: string, _version: number, options: unknown) => {
    s.options = options;
    const db = { close: vi.fn(), createObjectStore: vi.fn() };
    s.dbs.push(db);
    return Promise.resolve(db);
  });
  return s;
});

vi.mock('idb', () => ({ openDB: state.openDB }));

function fakeDb(): { db: FakeDb; createIndex: ReturnType<typeof vi.fn> } {
  const createIndex = vi.fn();
  const db: FakeDb = {
    close: vi.fn(),
    createObjectStore: vi.fn(() => ({ createIndex })),
  };
  return { db, createIndex };
}

async function loadModule() {
  vi.resetModules();
  return import('../src/offline/db');
}

describe('offline db', () => {
  beforeEach(() => {
    state.openDB.mockClear();
    state.dbs.length = 0;
    state.options = null;
  });

  it('opens the database only once', async () => {
    const { getDb } = await loadModule();
    await getDb();
    await getDb();
    expect(state.openDB).toHaveBeenCalledTimes(1);
  });

  it('closes and reopens lazily when another tab needs an upgrade', async () => {
    const { getDb } = await loadModule();
    const first = (await getDb()) as unknown as FakeDb;
    (state.options as OpenOptions).blocking();
    await Promise.resolve();
    expect(first.close).toHaveBeenCalledTimes(1);
    await getDb();
    expect(state.openDB).toHaveBeenCalledTimes(2);
  });

  it('creates all stores and the index from scratch', async () => {
    const { getDb } = await loadModule();
    await getDb();
    const { db, createIndex } = fakeDb();
    (state.options as OpenOptions).upgrade(db, 0);
    const names = db.createObjectStore.mock.calls.map((c) => c[0]);
    expect(names).toEqual([
      'kv',
      'offline',
      'evicted',
      'tracks',
      'playlists',
      'stations',
      'folders',
      'plays',
      'study',
      'local-extras',
    ]);
    expect(createIndex).toHaveBeenCalledWith('by-startedAt', 'startedAt');
  });

  it('only creates plays, study and local-extras when upgrading from version 3', async () => {
    const { getDb } = await loadModule();
    await getDb();
    const { db, createIndex } = fakeDb();
    (state.options as OpenOptions).upgrade(db, 3);
    expect(db.createObjectStore.mock.calls.map((c) => c[0])).toEqual([
      'plays',
      'study',
      'local-extras',
    ]);
    expect(createIndex).toHaveBeenCalledWith('by-startedAt', 'startedAt');
  });

  it('only creates study and local-extras when upgrading from version 4', async () => {
    const { getDb } = await loadModule();
    await getDb();
    const { db } = fakeDb();
    (state.options as OpenOptions).upgrade(db, 4);
    expect(db.createObjectStore.mock.calls.map((c) => c[0])).toEqual(['study', 'local-extras']);
  });
});
