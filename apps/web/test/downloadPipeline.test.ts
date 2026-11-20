import { describe, expect, it } from 'vitest';
import {
  jobsForNative,
  nextToSave,
  nextWakeAt,
  reconcile,
  saveConcurrency,
} from '../src/downloads/pipeline';
import type {
  DownloadJob,
  DownloadedFile,
  JobStatus,
  NativePending,
  NativeResult,
} from '../src/downloads/types';

const file = { path: '/p', bytes: 1, ext: 'opus', info: {} } as unknown as DownloadedFile;

const job = (id: string, status: JobStatus, extra: Partial<DownloadJob> = {}): DownloadJob => ({
  id,
  videoId: `v${id}`,
  title: id,
  author: '',
  thumbnail: '',
  status,
  progress: 0,
  keepOffline: false,
  createdAt: 1,
  ...extra,
});

const pending = (extra: Partial<NativePending> = {}): NativePending => ({
  queued: [],
  current: null,
  results: [],
  waitingNetwork: false,
  ...extra,
});

const result = (jobId: string): NativeResult => ({ jobId, ok: true });

describe('saveConcurrency', () => {
  it('is 1 for device and 2 for the cloud homes', () => {
    expect(saveConcurrency('device')).toBe(1);
    expect(saveConcurrency('drive')).toBe(2);
    expect(saveConcurrency('cloudflare')).toBe(2);
  });
});

describe('nextToSave', () => {
  it('picks the oldest downloaded job', () => {
    const jobs = [
      job('a', 'downloaded', { createdAt: 5 }),
      job('b', 'downloaded', { createdAt: 2 }),
    ];
    expect(nextToSave(jobs, 10, new Set())?.id).toBe('b');
  });

  it('skips busy jobs, other statuses and future retries', () => {
    const jobs = [
      job('a', 'downloaded', { createdAt: 1 }),
      job('b', 'queued', { createdAt: 2 }),
      job('c', 'downloaded', { createdAt: 3, retryAt: 100 }),
      job('d', 'downloaded', { createdAt: 4, retryAt: 10 }),
    ];
    expect(nextToSave(jobs, 10, new Set(['a']))?.id).toBe('d');
    expect(nextToSave(jobs, 10, new Set(['a', 'd']))).toBeUndefined();
  });
});

describe('nextWakeAt', () => {
  it('returns the earliest future retryAt', () => {
    const jobs = [
      job('a', 'downloaded', { retryAt: 50 }),
      job('b', 'downloaded', { retryAt: 30 }),
      job('c', 'downloaded', { retryAt: 5 }),
      job('d', 'error', { retryAt: 20 }),
    ];
    expect(nextWakeAt(jobs, 10)).toBe(30);
  });

  it('returns null when nothing waits', () => {
    expect(
      nextWakeAt([job('a', 'downloaded'), job('b', 'downloaded', { retryAt: 5 })], 10),
    ).toBeNull();
  });
});

describe('jobsForNative', () => {
  it('returns queued jobs not yet known to native', () => {
    const jobs = [job('a', 'queued'), job('b', 'queued'), job('c', 'downloading')];
    expect(jobsForNative(jobs, new Set(['b']))).toEqual([{ jobId: 'a', videoId: 'va' }]);
  });
});

describe('reconcile', () => {
  it('turns saving into downloaded when it has a file, else queued', () => {
    const { jobs } = reconcile([job('a', 'saving', { file }), job('b', 'saving')], pending());
    expect(jobs.map((j) => j.status)).toEqual(['downloaded', 'queued']);
  });

  it('requeues a downloading job native no longer knows', () => {
    const saved = [
      job('a', 'downloading', { progress: 40 }),
      job('b', 'downloading'),
      job('c', 'downloading'),
      job('d', 'downloading'),
    ];
    const native = pending({ queued: ['b'], current: 'c', results: [result('d')] });
    const { jobs } = reconcile(saved, native);
    expect(jobs.map((j) => j.status)).toEqual([
      'queued',
      'downloading',
      'downloading',
      'downloading',
    ]);
    expect(jobs[0]?.progress).toBe(0);
  });

  it('sends results of active jobs to finished', () => {
    const { jobs, finished, orphans } = reconcile(
      [job('a', 'downloading')],
      pending({ results: [result('a')] }),
    );
    expect(finished).toEqual([result('a')]);
    expect(orphans).toEqual([]);
    expect(jobs[0]?.status).toBe('downloading');
  });

  it('reports results of canceled, done or unknown jobs as orphans', () => {
    const saved = [job('a', 'canceled'), job('b', 'done')];
    const native = pending({ results: [result('a'), result('b'), result('zzz')] });
    const { finished, orphans } = reconcile(saved, native);
    expect(finished).toEqual([]);
    expect(orphans).toEqual(['a', 'b', 'zzz']);
  });

  it('leaves results of downloaded or saving jobs alone (not finished, not orphans)', () => {
    const saved = [job('a', 'downloaded', { file }), job('b', 'saving', { file })];
    const native = pending({ results: [result('a'), result('b')] });
    const { finished, orphans } = reconcile(saved, native);
    expect(finished).toEqual([]);
    expect(orphans).toEqual([]);
  });

  it('leaves other jobs unchanged', () => {
    const saved = [job('a', 'done'), job('b', 'queued'), job('c', 'downloaded', { file })];
    expect(reconcile(saved, pending()).jobs).toEqual(saved);
  });
});
