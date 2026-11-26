import { describe, expect, it } from 'vitest';
import {
  jobsForNative,
  nextToSave,
  nextWakeAt,
  reconcile,
  saveConcurrency,
  saveTarget,
  stuckSaving,
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
    expect(nextToSave(jobs, 10, new Set(), 'device')?.id).toBe('b');
  });

  it('skips busy jobs, other statuses and future retries', () => {
    const jobs = [
      job('a', 'downloaded', { createdAt: 1 }),
      job('b', 'queued', { createdAt: 2 }),
      job('c', 'downloaded', { createdAt: 3, retryAt: 100 }),
      job('d', 'downloaded', { createdAt: 4, retryAt: 10 }),
    ];
    expect(nextToSave(jobs, 10, new Set(['a']), 'cloudflare')?.id).toBe('d');
    expect(nextToSave(jobs, 10, new Set(['a', 'd']), 'cloudflare')).toBeUndefined();
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
    expect(jobsForNative(jobs, new Set(['b']))).toEqual([
      { jobId: 'a', videoId: 'va', title: 'a' },
    ]);
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

const MB = 1024 * 1024;
const sized = (id: string, bytes: number, extra: Partial<DownloadJob> = {}) =>
  job(id, 'downloaded', { file: { ...file, bytes }, ...extra });

describe('saveTarget', () => {
  it('keeps on the phone only what does not fit in Cloudflare', () => {
    expect(saveTarget('cloudflare', 96 * MB)).toBe('device-only');
    expect(saveTarget('cloudflare', 95 * MB)).toBe('home');
    expect(saveTarget('drive', 500 * MB)).toBe('home');
    expect(saveTarget('device', 500 * MB)).toBe('home');
  });
});

describe('save lanes', () => {
  it('uploads only one big file at a time and lets small ones pass', () => {
    const jobs = [
      sized('a', 40 * MB, { createdAt: 1 }),
      sized('b', 40 * MB, { createdAt: 2 }),
      sized('c', MB, { createdAt: 3 }),
    ];
    expect(nextToSave(jobs, 10, new Set(['a']), 'cloudflare')?.id).toBe('c');
    expect(nextToSave(jobs, 10, new Set(['a', 'c']), 'drive')).toBeUndefined();
  });

  it('saves phone-only audio in its own lane, one at a time', () => {
    const jobs = [
      sized('a', 100 * MB, { createdAt: 1 }),
      sized('b', 100 * MB, { createdAt: 2 }),
      sized('c', MB, { createdAt: 3 }),
      sized('d', MB, { createdAt: 4 }),
    ];
    expect(nextToSave(jobs, 10, new Set(['a']), 'cloudflare')?.id).toBe('c');
    expect(nextToSave(jobs, 10, new Set(['c', 'd']), 'cloudflare')?.id).toBe('a');
    expect(nextToSave(jobs, 10, new Set(['a', 'c', 'd']), 'cloudflare')).toBeUndefined();
  });

  it('ignores a phone-only target once the library is not in Cloudflare', () => {
    const jobs = [
      sized('a', MB, { target: 'device-only' }),
      sized('b', MB, { target: 'device-only', createdAt: 2 }),
    ];
    expect(nextToSave(jobs, 10, new Set(['a']), 'drive')?.id).toBe('b');
    expect(nextToSave(jobs, 10, new Set(['a']), 'cloudflare')).toBeUndefined();
  });
});

describe('stuckSaving', () => {
  it('finds saves older than their time limit plus two minutes', () => {
    const limit = 120_000 + 120_000;
    const jobs = [
      job('old', 'saving', { file, savingSince: 0 }),
      job('new', 'saving', { file, savingSince: 5000 }),
      job('done', 'done', { file, savingSince: 0 }),
    ];
    expect(stuckSaving(jobs, limit + 1)).toEqual(['old']);
  });
});

describe('reconcile with the library home', () => {
  it('moves a stuck oversized save to the phone lane', () => {
    const saved = [job('a', 'saving', { file: { ...file, bytes: 100 * MB } })];
    const { jobs } = reconcile(saved, pending(), 'cloudflare');
    expect(jobs[0]).toMatchObject({ status: 'downloaded', target: 'device-only' });
  });
});
