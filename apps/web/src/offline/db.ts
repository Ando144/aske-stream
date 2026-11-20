import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Folder, Playlist, Station } from '@aske/shared';
import type { LocalTrack, LibrarySnapshot } from '../storage/types';
import type { PlayRecord } from '../stats/recap';
import type { OfflineEntry } from './planner';

export interface CachedLibrary {
  etag: string;
  library: Omit<LibrarySnapshot, 'etag'>;
  savedAt: number;
}

interface AskeDB extends DBSchema {
  kv: { key: string; value: unknown };
  /** Cloud songs temporarily cached for offline use (smart rotation). */
  offline: { key: string; value: OfflineEntry };
  /** Recently rotated-out songs, so the next fill picks something different. */
  evicted: { key: string; value: { trackId: string; evictedAt: number } };
  /** Library of the "this device" home (v2). */
  tracks: { key: string; value: LocalTrack };
  playlists: { key: string; value: Playlist };
  stations: { key: string; value: Station };
  folders: { key: string; value: Folder };
  /** Local listening history (opt-in) for the Recap. */
  plays: { key: string; value: PlayRecord; indexes: { 'by-startedAt': number } };
}

let dbPromise: Promise<IDBPDatabase<AskeDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<AskeDB>> {
  dbPromise ??= openDB<AskeDB>('aske', 4, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('kv');
        db.createObjectStore('offline', { keyPath: 'trackId' });
        db.createObjectStore('evicted', { keyPath: 'trackId' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('tracks', { keyPath: 'id' });
        db.createObjectStore('playlists', { keyPath: 'id' });
        db.createObjectStore('stations', { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (oldVersion < 4) {
        db.createObjectStore('plays', { keyPath: 'id' }).createIndex('by-startedAt', 'startedAt');
      }
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
