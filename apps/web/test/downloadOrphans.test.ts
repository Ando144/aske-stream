import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadJob } from '../src/downloads/types';
import type { LocalTrack } from '../src/storage/types';

const h = vi.hoisted(() => ({
  home: 'cloudflare',
  loaded: true,
  tracks: {} as Record<string, unknown>,
  /** What the cloud holds: `load` copies it into the library. */
  cloud: [] as { id: string }[],
}));

const load = vi.fn(async () => {
  h.tracks = Object.fromEntries(h.cloud.map((tr) => [tr.id, tr]));
});
const deleteTrack = vi.fn(async (id: string) => {
  h.cloud = h.cloud.filter((tr) => tr.id !== id);
});

vi.mock('../src/stores/library', () => ({
  useLibrary: {
    getState: () => ({ tracks: h.tracks, loaded: h.loaded, load, deleteTrack }),
  },
}));
vi.mock('../src/stores/setup', () => ({
  useSetup: { getState: () => ({ config: { home: h.home } }) },
}));
vi.mock('../src/stores/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/native/downloader', () => ({
  Downloader: { cancel: vi.fn(async () => undefined), ack: vi.fn(async () => undefined) },
}));
vi.mock('../src/api/client', () => ({ api: { sendUpdate: vi.fn(async () => undefined) } }));
vi.mock('../src/downloads/imports', () => ({ findInLibrary: () => undefined }));
vi.mock('../src/stores/downloads', () => ({
  useDownloads: { subscribe: () => () => undefined },
}));

const { findOrphans, idsForVideo, sweepAfterCancel } = await import('../src/downloads/orphans');
const { createJobControls } = await import('../src/downloads/cancel');

const track = (id: string, sourceRef: string, source = 'youtube') =>
  ({ id, source, sourceRef }) as LocalTrack;

const job = (patch: Partial<DownloadJob> = {}) =>
  ({ id: 'j1', videoId: 'vid', status: 'saving', ...patch }) as DownloadJob;

/** Cancels a job through the real controls, as the X button does. */
async function cancelSaving() {
  let jobs = [job()];
  const controls = createJobControls({
    get: () => ({ jobs, saving: [] }) as never,
    set: () => undefined,
    update: (id, patch) => {
      jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    },
  });
  await controls.cancel('j1');
}

const canceled = () => job({ status: 'canceled' });

/** A job list that tells its watchers about every change, like the downloads store. */
function jobsFeed(initial: DownloadJob[] = []) {
  let jobs = initial;
  const watchers = new Set<(next: DownloadJob[]) => void>();
  return {
    watchers,
    current: () => jobs,
    watch: (onChange: (next: DownloadJob[]) => void) => {
      watchers.add(onChange);
      return () => void watchers.delete(onChange);
    },
    set: (next: DownloadJob[]) => {
      jobs = next;
      watchers.forEach((onChange) => onChange(next));
    },
  };
}

const sweepWith = (feed: ReturnType<typeof jobsFeed>) =>
  sweepAfterCancel(canceled(), [], feed.current, feed.watch);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  h.home = 'cloudflare';
  h.loaded = true;
  h.tracks = {};
  h.cloud = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('orphan detection', () => {
  const tracks = [track('a', 'vid'), track('b', 'other'), track('c', 'vid', 'upload')];

  it('lists the ids of the songs of one video', () => {
    expect(idsForVideo(tracks, 'vid')).toEqual(['a']);
  });

  it('finds only the songs of that video that were not there before', () => {
    const now = [...tracks, track('d', 'vid')];
    expect(findOrphans(now, 'vid', ['a']).map((t) => t.id)).toEqual(['d']);
  });
});

describe('canceling a save that the cloud already received', () => {
  it.each(['cloudflare', 'drive'])('deletes the song that shows up later (%s)', async (home) => {
    h.home = home;
    await cancelSaving();
    h.cloud = [track('new', 'vid')];
    await vi.advanceTimersByTimeAsync(4_999);
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(deleteTrack).toHaveBeenCalledExactlyOnceWith('new');
  });

  it('looks again after 60 s for a song that took longer', async () => {
    await cancelSaving();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(deleteTrack).not.toHaveBeenCalled();
    h.cloud = [track('late', 'vid')];
    await vi.advanceTimersByTimeAsync(55_000);
    expect(deleteTrack).toHaveBeenCalledExactlyOnceWith('late');
  });

  it('keeps a song of the same video that was already there', async () => {
    h.cloud = [track('old', 'vid')];
    h.tracks = { old: h.cloud[0] };
    await cancelSaving();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(deleteTrack).not.toHaveBeenCalled();
  });

  it('does not reload anything when the library lives on the phone', async () => {
    h.home = 'device';
    await cancelSaving();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).not.toHaveBeenCalled();
  });

  it('does nothing when the library was not loaded, as old songs would look new', async () => {
    h.loaded = false;
    await cancelSaving();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).not.toHaveBeenCalled();
  });
});

describe('sweep safety', () => {
  it('leaves the song alone while the same video is being downloaded again', async () => {
    sweepWith(jobsFeed([job({ id: 'j2', status: 'downloading' })]));
    h.cloud = [track('new', 'vid')];
    await vi.advanceTimersByTimeAsync(60_000);
    expect(deleteTrack).not.toHaveBeenCalled();
  });

  it('keeps the song that a later download of the same video saved', async () => {
    sweepWith(jobsFeed([job({ id: 'j2', status: 'done', trackId: 'kept' })]));
    h.cloud = [track('kept', 'vid')];
    await vi.advanceTimersByTimeAsync(60_000);
    expect(deleteTrack).not.toHaveBeenCalled();
  });

  it('keeps the found song that a skipped job points to', async () => {
    const feed = jobsFeed([canceled()]);
    sweepWith(feed);
    await vi.advanceTimersByTimeAsync(5_000);
    // The song reached the library after the first pass, and the user asked for the video again.
    h.cloud = [track('found', 'vid')];
    feed.set([canceled(), job({ id: 'j2', status: 'skipped', trackId: 'found' })]);
    await vi.advanceTimersByTimeAsync(55_000);
    expect(deleteTrack).not.toHaveBeenCalled();
  });

  it.each(['done', 'skipped'] as const)(
    'still keeps the song of a %s job cleared from the list',
    async (status) => {
      const feed = jobsFeed();
      sweepWith(feed);
      feed.set([job({ id: 'j2', status, trackId: 'kept' })]);
      feed.set([]);
      h.cloud = [track('kept', 'vid')];
      await vi.advanceTimersByTimeAsync(60_000);
      expect(deleteTrack).not.toHaveBeenCalled();
    },
  );

  it('stops watching the jobs after the last pass', async () => {
    const feed = jobsFeed();
    sweepWith(feed);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(feed.watchers.size).toBe(1);
    await vi.advanceTimersByTimeAsync(55_000);
    expect(feed.watchers.size).toBe(0);
  });

  it('stops when the user switched to another storage', async () => {
    sweepWith(jobsFeed());
    h.home = 'drive';
    h.cloud = [track('new', 'vid')];
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).not.toHaveBeenCalled();
    expect(deleteTrack).not.toHaveBeenCalled();
  });

  it('logs a failure and tries again on the second pass', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    load.mockRejectedValueOnce(new Error('boom'));
    sweepWith(jobsFeed());
    h.cloud = [track('new', 'vid')];
    await vi.advanceTimersByTimeAsync(60_000);
    expect(log).toHaveBeenCalledOnce();
    expect(deleteTrack).toHaveBeenCalledExactlyOnceWith('new');
    log.mockRestore();
  });
});
