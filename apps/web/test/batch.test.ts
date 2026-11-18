import { describe, expect, it } from 'vitest';
import {
  arrangeImportedPlaylist,
  batchForRetry,
  importsToKeep,
  notificationCounts,
  uniquePlaylistName,
  type BatchJob,
  type BatchJobStatus,
} from '../src/downloads/batch';

const job = (status: BatchJobStatus, batchId?: string, createdAt = 1): BatchJob => ({
  status,
  batchId,
  createdAt,
});
const many = (n: number, status: BatchJobStatus, batchId?: string) =>
  Array.from({ length: n }, () => job(status, batchId));

describe('notificationCounts', () => {
  it('returns null when nothing is active', () => {
    expect(notificationCounts([])).toBeNull();
    expect(notificationCounts([job('done', 'a'), job('error', 'a')])).toBeNull();
  });

  it('does not count skipped tracks (19 of 30 already owned)', () => {
    const jobs = [...many(19, 'skipped', 'a'), ...many(11, 'queued', 'a')];
    expect(notificationCounts(jobs)).toEqual({ position: 1, total: 11 });
  });

  it('ignores finished jobs from old batches (the "20/30" case)', () => {
    const jobs = [...many(20, 'done', 'old'), ...many(10, 'error', 'old'), job('queued', 'new')];
    expect(notificationCounts(jobs)).toEqual({ position: 1, total: 1 });
  });

  it('adds up several active batches', () => {
    const jobs = [
      ...many(2, 'done', 'a'),
      ...many(3, 'queued', 'a'),
      ...many(4, 'queued', 'b'),
      ...many(5, 'done', 'c'),
    ];
    expect(notificationCounts(jobs)).toEqual({ position: 3, total: 9 });
  });

  it('subtracts canceled jobs from the total', () => {
    const jobs = [...many(3, 'canceled', 'a'), ...many(2, 'queued', 'a')];
    expect(notificationCounts(jobs)).toEqual({ position: 1, total: 2 });
  });

  it('treats jobs without batchId as one legacy batch', () => {
    const jobs = [job('done'), job('downloading'), job('queued'), ...many(4, 'done', 'old')];
    expect(notificationCounts(jobs)).toEqual({ position: 2, total: 3 });
  });

  it('never lets position exceed total', () => {
    const jobs = [job('done', 'a'), job('error', 'a'), job('saving', 'a')];
    expect(notificationCounts(jobs)).toEqual({ position: 3, total: 3 });
    const finishing = [job('saving', 'a'), job('done', 'a'), job('done', 'a')];
    expect(notificationCounts(finishing)?.position).toBeLessThanOrEqual(3);
  });
});

describe('batchForRetry', () => {
  it('returns the most recent active batch', () => {
    const jobs = [job('queued', 'a', 10), job('downloading', 'b', 50), job('done', 'c', 90)];
    expect(batchForRetry(jobs, 1000)).toBe('b');
  });

  it('creates a new batch when none is active', () => {
    expect(batchForRetry([job('done', 'a')], 36 * 36)).toBe(`b${(36 * 36).toString(36)}`);
    expect(batchForRetry([], 36)).toBe('b10');
  });

  it('uses the legacy batch for jobs without batchId', () => {
    expect(batchForRetry([job('queued', undefined, 5)], 1)).toBe('legacy');
  });
});

describe('arrangeImportedPlaylist', () => {
  const ids: Record<string, string | undefined> = { v1: 't1', v2: 't2', v3: 't3', v4: undefined };
  const lookup = (v: string) => ids[v];

  it('puts imported tracks first in YouTube order, then foreign ones', () => {
    const result = arrangeImportedPlaylist(['v3', 'v1', 'v2'], ['x', 't2', 'y'], lookup, 100);
    expect(result).toEqual(['t3', 't1', 't2', 'x', 'y']);
  });

  it('skips videos that do not exist yet', () => {
    expect(arrangeImportedPlaylist(['v4', 'v1'], [], lookup, 100)).toEqual(['t1']);
  });

  it('does not duplicate and truncates to max', () => {
    expect(arrangeImportedPlaylist(['v1', 'v1', 'v2'], ['t1', 'z', 'z'], lookup, 100)).toEqual([
      't1',
      't2',
      'z',
    ]);
    expect(arrangeImportedPlaylist(['v1', 'v2', 'v3'], ['x'], lookup, 2)).toEqual(['t1', 't2']);
  });
});

describe('uniquePlaylistName', () => {
  it('returns the name untouched when free', () => {
    expect(uniquePlaylistName('Mix', ['Other'], 60)).toBe('Mix');
  });

  it('adds the first free number', () => {
    expect(uniquePlaylistName('Mix', ['Mix'], 60)).toBe('Mix (1)');
    expect(uniquePlaylistName('Mix', ['Mix', 'Mix (1)', 'Mix (3)'], 60)).toBe('Mix (2)');
  });

  it('ignores case and surrounding spaces', () => {
    expect(uniquePlaylistName('Mix', ['mix '], 60)).toBe('Mix (1)');
    expect(uniquePlaylistName('Mix', ['MIX', ' mix (1)'], 60)).toBe('Mix (2)');
  });

  it('trims the base, never the suffix, to respect maxLength', () => {
    const result = uniquePlaylistName('abcdefghij', ['abcdefghij'], 8);
    expect(result).toBe('abcd (1)');
  });
});

describe('retry keeps the YouTube order', () => {
  const videoIds = Array.from({ length: 30 }, (_, i) => `v${i + 1}`);
  const trackIdOf = (v: string) => `t-${v}`;

  it('keeps an import while one of its songs failed', () => {
    const imports = [{ playlistId: 'p', videoIds }];
    const jobs = videoIds.map((videoId) => ({
      videoId,
      status: videoId === 'v15' ? ('error' as const) : ('done' as const),
    }));
    expect(importsToKeep(imports, jobs)).toEqual(imports);
  });

  it('drops the import once failed jobs are discarded', () => {
    const imports = [{ playlistId: 'p', videoIds }];
    expect(importsToKeep(imports, [{ videoId: 'v1', status: 'done' }])).toEqual([]);
  });

  it('keeps an import while one of its songs is canceled, so a retry still joins it', () => {
    const imports = [{ playlistId: 'p', videoIds }];
    const jobs = [
      { videoId: 'v1', status: 'done' as const },
      { videoId: 'v2', status: 'canceled' as const },
    ];
    expect(importsToKeep(imports, jobs)).toEqual(imports);
  });

  it('drops the import once canceled jobs are cleared', () => {
    const imports = [{ playlistId: 'p', videoIds }];
    expect(importsToKeep(imports, [{ videoId: 'v1', status: 'done' }])).toEqual([]);
  });

  it('places song 15 at position 15 after retrying it', () => {
    const without15 = videoIds.filter((v) => v !== 'v15').map(trackIdOf);
    const arranged = arrangeImportedPlaylist(videoIds, [], trackIdOf, 1000);
    expect(arranged).toEqual(videoIds.map(trackIdOf));
    const retried = arrangeImportedPlaylist(videoIds, without15, (v) => trackIdOf(v), 1000);
    expect(retried.indexOf('t-v15')).toBe(14);
  });
});
