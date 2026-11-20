import { getDb } from '../offline/db';
import type { PlayRecord } from './recap';

export interface StatsRepo {
  /** Insert or update by id. */
  put(record: PlayRecord): Promise<void>;
  listBetween(from: number, to: number): Promise<PlayRecord[]>;
  clear(): Promise<void>;
}

export const idbStatsRepo: StatsRepo = {
  async put(record) {
    await (await getDb()).put('plays', record);
  },
  async listBetween(from, to) {
    const range = IDBKeyRange.bound(from, to, false, true);
    return (await getDb()).getAllFromIndex('plays', 'by-startedAt', range);
  },
  async clear() {
    await (await getDb()).clear('plays');
  },
};

export function memoryStatsRepo(): StatsRepo {
  const records = new Map<string, PlayRecord>();
  return {
    async put(record) {
      records.set(record.id, { ...record });
    },
    async listBetween(from, to) {
      return [...records.values()].filter((r) => r.startedAt >= from && r.startedAt < to);
    },
    async clear() {
      records.clear();
    },
  };
}
