import { getDb } from '../offline/db';
import type { StudyRecord } from './records';

export interface StudyRepo {
  /** Insert or update by id. */
  put(record: StudyRecord): Promise<void>;
  listBetween(from: number, to: number): Promise<StudyRecord[]>;
  clear(): Promise<void>;
}

export const idbStudyRepo: StudyRepo = {
  async put(record) {
    await (await getDb()).put('study', record);
  },
  async listBetween(from, to) {
    const range = IDBKeyRange.bound(from, to, false, true);
    return (await getDb()).getAllFromIndex('study', 'by-startedAt', range);
  },
  async clear() {
    await (await getDb()).clear('study');
  },
};

export function memoryStudyRepo(): StudyRepo {
  const records = new Map<string, StudyRecord>();
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

let repo: StudyRepo = idbStudyRepo;

/** Tests only. */
export function setStudyRepo(next: StudyRepo): void {
  repo = next;
}

export function getStudyRepo(): StudyRepo {
  return repo;
}
