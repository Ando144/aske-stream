import type { SearchKind, SearchResult } from '@aske/shared/youtube';
import type { DownloaderPlugin, PlaylistListing } from '../../src/native/downloader';
import type { NativeResult } from '../../src/downloads/types';

/**
 * Fake yt-dlp for browser tests: "downloads" serve a small real WebM Opus
 * file and a 16:9 picture from /test-media/, with progress events.
 * Video ids starting with "fail" fail like a removed video.
 */
type Listener = (p: { jobId: string; progress: number; eta: number }) => void;
const listeners = new Set<Listener>();
const finishedListeners = new Set<(r: NativeResult) => void>();
const networkListeners = new Set<(p: { waiting: boolean }) => void>();
const nativeQueue: { jobId: string; videoId: string }[] = [];
let nativeCurrent: string | null = null;
const nativeResults: NativeResult[] = [];
let pumping = false;
const canceled = new Set<string>();
const w = window as unknown as { __fakeNative: { calls: string[]; notification: unknown } };
w.__fakeNative = { calls: [], notification: null };
const log = (s: string) => w.__fakeNative.calls.push(s);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fakeDownload(jobId: string, videoId: string) {
  log(`download ${videoId}`);
  for (const progress of [10, 45, 80, 100]) {
    await sleep(80);
    if (canceled.has(jobId)) throw Object.assign(new Error('Canceled'), { code: 'canceled' });
    listeners.forEach((l) => l({ jobId, progress, eta: 1 }));
  }
  if (videoId.startsWith('fail')) {
    throw Object.assign(new Error('ERROR: [youtube] fail: Video unavailable'), {
      code: 'download_failed',
    });
  }
  return {
    path: '/test-media/song.webm',
    bytes: 38931,
    ext: 'webm',
    info: {
      id: videoId,
      title: `Band - Song ${videoId} (Official Video)`,
      uploader: 'BandVEVO',
      duration: 4,
      abr: 64,
    },
  };
}

async function runNativeJob(jobId: string, videoId: string): Promise<NativeResult> {
  try {
    const done = await fakeDownload(jobId, videoId);
    return { jobId, ok: true, ...done, elapsedMs: 320 };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const code = err.code === 'canceled' ? 'canceled' : 'download_failed';
    return { jobId, ok: false, error: err.message, code };
  }
}

/** Simulates the phone's queue: one job at a time, each finishing after a short delay. */
async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  for (let next = nativeQueue.shift(); next; next = nativeQueue.shift()) {
    nativeCurrent = next.jobId;
    const result = await runNativeJob(next.jobId, next.videoId);
    nativeCurrent = null;
    nativeResults.push(result);
    finishedListeners.forEach((l) => l(result));
  }
  pumping = false;
}

export const Downloader: DownloaderPlugin = {
  queue: async ({ jobs }) => {
    log(`queue ${jobs.map((j) => j.videoId).join(',')}`);
    const known = new Set<string | null>([
      ...nativeQueue.map((j) => j.jobId),
      ...nativeResults.map((r) => r.jobId),
      nativeCurrent,
    ]);
    nativeQueue.push(...jobs.filter((j) => !known.has(j.jobId)));
    void pump();
  },
  pending: async () => ({
    queued: nativeQueue.map((j) => j.jobId),
    current: nativeCurrent,
    results: [...nativeResults],
    waitingNetwork: false,
  }),
  ack: async ({ jobId }) => {
    const i = nativeResults.findIndex((r) => r.jobId === jobId);
    if (i >= 0) nativeResults.splice(i, 1);
  },
  init: async () => (log('init'), { version: '2025.11.12' }),
  updateEngine: async () => (log('update'), { updated: true, version: '2026.11.01' }),
  list: async ({ url }) => {
    log(`list ${url}`);
    // "PLbig" is a long playlist (like the 168-song one that showed an empty panel).
    const count = url.includes('PLbig') ? 150 : 3;
    return {
      title: url.includes('PLbig') ? 'Big playlist' : 'Test playlist',
      uploader: 'Tester',
      entries: Array.from({ length: count }, (_, i) => i + 1).map((n) => ({
        // Different playlists (by their last letters) give different songs.
        id: url.includes('RESUME')
          ? `resume00000${n}`
          : `${url.includes('PLbig') ? 'big' : 'plvid'}${String(n).padStart(8, '0')}`,
        title: `Band - Track ${n} (Official Video)`,
        uploader: 'BandVEVO',
        duration: 4,
      })),
    };
  },
  cancel: async ({ jobId }) => {
    canceled.add(jobId);
    const i = nativeQueue.findIndex((j) => j.jobId === jobId);
    if (i >= 0) nativeQueue.splice(i, 1);
    return { canceled: true };
  },
  fetchImage: async () => ({ path: '/test-media/thumb.jpg' }),
  deleteFile: async ({ path }) => void log(`delete ${path}`),
  setNotification: async (n) => {
    w.__fakeNative.notification = n;
  },
  requestNotifications: async () => ({ granted: true }),
  addListener: (async (event: string, listener: unknown) => {
    const set = (
      event === 'finished' ? finishedListeners : event === 'network' ? networkListeners : listeners
    ) as Set<unknown>;
    set.add(listener);
    return { remove: async () => void set.delete(listener) };
  }) as DownloaderPlugin['addListener'],
};

export async function searchOnPhone(query: string, kind: SearchKind): Promise<SearchResult[]> {
  log(`search ${kind} ${query}`);
  if (kind === 'playlists') {
    return [
      {
        kind: 'playlist',
        id: 'PLtest0000001',
        title: 'Test playlist',
        author: 'Tester',
        count: 3,
        thumbnail: '/test-media/thumb.jpg',
        url: 'https://www.youtube.com/playlist?list=PLtest0000001',
      },
      {
        kind: 'playlist',
        id: 'PLbig00000001',
        title: 'Big playlist',
        author: 'Tester',
        count: 150,
        thumbnail: '/test-media/thumb.jpg',
        url: 'https://www.youtube.com/playlist?list=PLbig00000001',
      },
    ];
  }
  return ['song0000001', 'song0000002', 'fail0000001'].map((id, i) => ({
    kind: 'video' as const,
    id,
    title: `Result ${i + 1}`,
    author: 'Band',
    duration: 200 + i,
    thumbnail: '/test-media/thumb.jpg',
    url: `https://www.youtube.com/watch?v=${id}`,
  }));
}

export async function listPlaylistOnPhone(
  url: string,
  _lang?: string,
  _onPartial?: (partial: PlaylistListing) => void,
): Promise<PlaylistListing> {
  const list = await Downloader.list({ url });
  return {
    title: list.title,
    author: list.uploader,
    entries: list.entries.map((e) => ({
      id: e.id,
      title: e.title,
      author: e.uploader,
      duration: e.duration,
    })),
    totalCount: list.entries.length,
    complete: true,
  };
}
