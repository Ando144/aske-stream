import { describe, expect, it } from 'vitest';
import {
  batchProgress,
  buildNotification,
  createBatchTracker,
  doneNotice,
  jobsForFinalNotice,
  PROGRESS_MIN_GAP_MS,
  shouldSend,
  type Translate,
} from '../src/downloads/notification';
import type { DownloadJob, JobStatus } from '../src/downloads/types';

const t: Translate = (key, params) =>
  params
    ? `${key}|${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join('|')}`
    : key;

function job(id: number, status: JobStatus, progress = 0, batchId = 'b1'): DownloadJob {
  return {
    id: `j${id}`,
    videoId: `v${id}`,
    title: `Song ${id}`,
    author: '',
    thumbnail: '',
    status,
    progress,
    batchId,
    keepOffline: false,
    createdAt: id,
  };
}

/** `done` finished songs, then the given active ones, up to `total` songs in the batch. */
function batch(done: number, active: DownloadJob[]): DownloadJob[] {
  const finished = Array.from({ length: done }, (_, i) => job(100 + i, 'done', 100));
  return [...finished, ...active];
}

describe('batchProgress', () => {
  it('3rd of 10 at 50 % is 25', () => {
    expect(batchProgress(2, 0.5, 10)).toBe(25);
  });
  it('saving the 3rd is 30', () => {
    expect(batchProgress(2, 1, 10)).toBe(30);
  });
  it('never goes above 100', () => {
    expect(batchProgress(10, 1, 10)).toBe(100);
  });
});

describe('buildNotification', () => {
  it('is null when nothing is active', () => {
    expect(buildNotification([job(1, 'done')], false, t)).toBeNull();
  });

  it('shows downloading phase with counter, song and how many are left', () => {
    const jobs = batch(2, [
      job(1, 'downloading', 50),
      ...[2, 3, 4, 5, 6, 7, 8].map((i) => job(i, 'queued')),
    ]);
    expect(buildNotification(jobs, false, t)).toEqual({
      title: 'dl.notifTitle|done=3|total=10',
      text: 'dl.notifText|title=Song 1|count=7',
      progress: 25,
    });
  });

  it('uses the "last" text for the final song', () => {
    const content = buildNotification([job(1, 'downloading', 10)], false, t)!;
    expect(content.text).toBe('dl.notifTextLast|title=Song 1');
  });

  it('shows the saving title when the current song is being saved', () => {
    const jobs = batch(2, [
      job(1, 'saving', 100),
      ...[2, 3, 4, 5, 6, 7, 8].map((i) => job(i, 'queued')),
    ]);
    const content = buildNotification(jobs, false, t)!;
    expect(content.title).toBe('dl.notifSavingTitle|done=3|total=10');
    expect(content.progress).toBe(30);
  });

  it('prefers the downloading song over the saving one', () => {
    const jobs = [job(1, 'saving', 100), job(2, 'downloading', 20)];
    const content = buildNotification(jobs, false, t)!;
    expect(content.title).toContain('dl.notifTitle');
    expect(content.text).toContain('Song 2');
    expect(content.title).toBe('dl.notifTitle|done=2|total=2');
    expect(content.progress).toBe(60);
  });

  it('never goes back across 5 songs while the batch advances', () => {
    const steps: DownloadJob[][] = [
      [
        job(1, 'downloading', 100),
        job(2, 'queued'),
        job(3, 'queued'),
        job(4, 'queued'),
        job(5, 'queued'),
      ],
      [
        job(1, 'saving', 100),
        job(2, 'downloading', 0),
        job(3, 'queued'),
        job(4, 'queued'),
        job(5, 'queued'),
      ],
      [
        job(1, 'done', 100),
        job(2, 'downloading', 30),
        job(3, 'queued'),
        job(4, 'queued'),
        job(5, 'queued'),
      ],
      [
        job(1, 'done', 100),
        job(2, 'saving', 100),
        job(3, 'downloading', 0),
        job(4, 'queued'),
        job(5, 'queued'),
      ],
    ];
    const values = steps.map((s) => buildNotification(s, false, t)!.progress);
    values.forEach((v, i) => {
      if (i > 0) expect(v).toBeGreaterThanOrEqual(values[i - 1]!);
    });
    expect(values[1]).toBe(20);
    expect(values[2]).toBe(26);
  });

  it('raises the bar to the floor and never above 100', () => {
    const jobs = batch(2, [job(1, 'downloading', 0), job(2, 'queued')]);
    expect(buildNotification(jobs, false, t, 70)!.progress).toBe(70);
    expect(buildNotification(jobs, false, t, 0)!.progress).toBe(50);
    expect(buildNotification(jobs, false, t, 250)!.progress).toBe(100);
  });

  it('does not go down when the batch grows from 5 to 10 songs', () => {
    const five = batch(3, [job(1, 'downloading', 50), job(2, 'queued')]);
    const before = buildNotification(five, false, t)!.progress;
    const ten = batch(3, [
      job(1, 'downloading', 50),
      ...[2, 3, 4, 5, 6, 7].map((i) => job(i, 'queued')),
    ]);
    expect(buildNotification(ten, false, t)!.progress).toBeLessThan(before);
    expect(buildNotification(ten, false, t, before)!.progress).toBe(before);
  });

  it('keeps the total bar and says it is waiting for the network', () => {
    const jobs = batch(3, [job(1, 'queued'), job(2, 'queued')]);
    const content = buildNotification(jobs, true, t)!;
    expect(content.text).toBe('dl.notifWaiting');
    expect(content.progress).toBe(batchProgress(3, 0, 5));
  });

  it('bar does not go down from saving to the next song', () => {
    const saving = buildNotification(
      batch(2, [job(1, 'saving', 100), job(2, 'queued')]),
      false,
      t,
    )!;
    const next = buildNotification(
      [...batch(2, [job(1, 'done', 100)]), job(2, 'downloading', 0)],
      false,
      t,
    )!;
    expect(next.progress).toBeGreaterThanOrEqual(saving.progress);
  });
});

describe('shouldSend', () => {
  const base = { title: 'a', text: 'b', progress: 10 };
  const prev = { content: base, at: 10_000 };

  it('sends the first one', () => {
    expect(shouldSend(null, base, 0)).toBe(true);
  });
  it('does not repeat identical content', () => {
    expect(shouldSend(prev, { ...base }, 12_000)).toBe(false);
  });
  it('resends identical content after the heartbeat so the service sees JS alive', () => {
    expect(shouldSend(prev, { ...base }, 15_000)).toBe(true);
  });
  it('sends a title or text change at once', () => {
    expect(shouldSend(prev, { ...base, title: 'x' }, 10_001)).toBe(true);
    expect(shouldSend(prev, { ...base, text: 'x' }, 10_001)).toBe(true);
  });
  it('limits progress changes to one per second', () => {
    const next = { ...base, progress: 11 };
    expect(shouldSend(prev, next, 10_000 + PROGRESS_MIN_GAP_MS - 1)).toBe(false);
    expect(shouldSend(prev, next, 10_000 + PROGRESS_MIN_GAP_MS)).toBe(true);
  });
});

describe('jobsForFinalNotice', () => {
  it('counts the whole batch even when songs finished over a minute ago', () => {
    const old = { ...job(1, 'done'), finishedAt: 1000 };
    const recent = { ...job(2, 'done', 0, 'b2'), finishedAt: 199_000 };
    const other = { ...job(3, 'done', 0, 'b3'), finishedAt: 1000 };
    const got = jobsForFinalNotice([old, recent, other], new Set(['b1']), 200_000);
    expect(got.map((j) => j.id)).toEqual(['j1', 'j2']);
  });
});

describe('createBatchTracker', () => {
  it('counts the batches seen active and forgets them after take()', () => {
    const tracker = createBatchTracker();
    tracker.collect([job(1, 'downloading')]);
    const finished = [{ ...job(1, 'done'), finishedAt: 1000 }];
    expect(tracker.take(finished, 500_000)).toHaveLength(1);
    expect(tracker.take(finished, 500_000)).toHaveLength(0);
  });
});

describe('doneNotice', () => {
  it('is null when nothing finished', () => {
    expect(doneNotice([job(1, 'skipped'), job(2, 'canceled')], t)).toBeNull();
  });
  it('counts saved songs', () => {
    expect(doneNotice([job(1, 'done'), job(2, 'done')], t)).toBe('dl.notifDone|count=2');
  });
  it('mentions failures', () => {
    expect(doneNotice([job(1, 'done'), job(2, 'error')], t)).toBe(
      'dl.notifDoneSomeFailed|count=1|failed=1',
    );
  });
  it('works when everything failed', () => {
    expect(doneNotice([job(1, 'error')], t)).toBe('dl.notifDoneSomeFailed|count=0|failed=1');
  });
});
