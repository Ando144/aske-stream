import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Library } from '@aske/shared';
import type { OfflineEntry } from './planner';

export interface CachedLibrary {
  etag: string;
  library: Library;
  savedAt: number;
}

interface AskeDB extends DBSchema {
  kv: { key: string; value: unknown };
  /** Tracks currently stored on this device. */
  offline: { key: string; value: OfflineEntry };
  /** Recently rotated-out tracks, so the next fill picks something different. */
  evicted: { key: string; value: { trackId: string; evictedAt: number } };
}

let dbPromise: Promise<IDBPDatabase<AskeDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<AskeDB>> {
  dbPromise ??= openDB<AskeDB>('aske', 1, {
    upgrade(db) {
      db.createObjectStore('kv');
      db.createObjectStore('offline', { keyPath: 'trackId' });
      db.createObjectStore('evicted', { keyPath: 'trackId' });
    },
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('kv', key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('kv', value, key);
}
