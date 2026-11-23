import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  put: vi.fn(async () => undefined),
  getAllFromIndex: vi.fn(async () => [] as unknown[]),
  clear: vi.fn(async () => undefined),
}));
vi.mock('../src/offline/db', () => ({ getDb: async () => db }));

import { getStudyRepo, idbStudyRepo, memoryStudyRepo, setStudyRepo } from '../src/study/repo';
import type { StudyRecord } from '../src/study/records';

function rec(id: string, startedAt: number, over: Partial<StudyRecord> = {}): StudyRecord {
  return {
    id,
    startedAt,
    endedAt: startedAt + 1000,
    plannedMin: 25,
    studiedMin: 25,
    completed: true,
    ...over,
  };
}

describe('memoryStudyRepo', () => {
  it('put with the same id updates instead of duplicating', async () => {
    const repo = memoryStudyRepo();
    await repo.put(rec('a', 10, { completed: false }));
    await repo.put(rec('a', 10, { completed: true }));
    expect(await repo.listBetween(0, 100)).toMatchObject([{ id: 'a', completed: true }]);
  });

  it('listBetween includes the lower bound and excludes the upper bound', async () => {
    const repo = memoryStudyRepo();
    await repo.put(rec('lo', 10));
    await repo.put(rec('mid', 15));
    await repo.put(rec('hi', 20));
    const ids = (await repo.listBetween(10, 20)).map((r) => r.id).sort();
    expect(ids).toEqual(['lo', 'mid']);
  });

  it('listBetween returns nothing for an empty or inverted range', async () => {
    const repo = memoryStudyRepo();
    await repo.put(rec('a', 10));
    expect(await repo.listBetween(10, 10)).toEqual([]);
    expect(await repo.listBetween(50, 5)).toEqual([]);
  });

  it('stores a copy, so mutating the original does not change the saved record', async () => {
    const repo = memoryStudyRepo();
    const original = rec('a', 10);
    await repo.put(original);
    original.studiedMin = 999;
    expect((await repo.listBetween(0, 100))[0]!.studiedMin).toBe(25);
  });

  it('clear removes everything', async () => {
    const repo = memoryStudyRepo();
    await repo.put(rec('a', 10));
    await repo.clear();
    expect(await repo.listBetween(0, 100)).toEqual([]);
  });
});

describe('idbStudyRepo', () => {
  beforeEach(() => {
    db.put.mockClear();
    db.getAllFromIndex.mockClear();
    db.clear.mockClear();
  });

  it('put writes to the study store', async () => {
    const r = rec('a', 10);
    await idbStudyRepo.put(r);
    expect(db.put).toHaveBeenCalledWith('study', r);
  });

  it('clear empties the study store', async () => {
    await idbStudyRepo.clear();
    expect(db.clear).toHaveBeenCalledWith('study');
  });

  it('listBetween queries the startedAt index with a half-open range', async () => {
    const bound = vi.fn((...args: unknown[]) => ({ args }));
    vi.stubGlobal('IDBKeyRange', { bound });
    db.getAllFromIndex.mockResolvedValueOnce([rec('a', 10)]);
    const result = await idbStudyRepo.listBetween(10, 20);
    expect(bound).toHaveBeenCalledWith(10, 20, false, true);
    expect(db.getAllFromIndex).toHaveBeenCalledWith('study', 'by-startedAt', expect.anything());
    expect(result).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});

describe('setStudyRepo / getStudyRepo', () => {
  it('returns the repo that was set', () => {
    const original = getStudyRepo();
    const mem = memoryStudyRepo();
    setStudyRepo(mem);
    expect(getStudyRepo()).toBe(mem);
    setStudyRepo(original);
  });
});
