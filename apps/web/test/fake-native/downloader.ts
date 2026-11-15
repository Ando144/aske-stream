import type { SearchKind, SearchResult } from '@aske/shared/youtube';
import type { DownloaderPlugin } from '../../src/native/downloader';

/**
 * Fake yt-dlp for browser tests: "downloads" serve a small real WebM Opus
 * file and a 16:9 picture from /test-media/, with progress events.
 * Video ids starting with "fail" fail like a removed video.
 */
type Listener = (p: { jobId: string; progress: number; eta: number }) => void;
const listeners = new Set<Listener>();
const canceled = new Set<string>();
const w = window as unknown as { __fakeNative: { calls: string[]; notification: unknown } };
w.__fakeNative = { calls: [], notification: null };
const log = (s: string) => w.__fakeNative.calls.push(s);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const Downloader: DownloaderPlugin = {
  init: async () => (log('init'), { version: '2025.11.12' }),
  updateEngine: async () => (log('update'), { updated: true, version: '2026.11.01' }),
  list: async ({ url }) => {
    log(`list ${url}`);
    return {
      title: 'Test playlist',
      uploader: 'Tester',
      entries: [1, 2, 3].map((n) => ({
        // Different playlists (by their last letters) give different songs.
        id: url.includes('RESUME') ? `resume00000${n}` : `plvid000000${n}`,
        title: `Band - Track ${n} (Official Video)`,
        uploader: 'BandVEVO',
        duration: 4,
      })),
    };
  },
  download: async ({ jobId, videoId }) => {
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
  },
  cancel: async ({ jobId }) => (canceled.add(jobId), { canceled: true }),
  fetchImage: async () => ({ path: '/test-media/thumb.jpg' }),
  deleteFile: async ({ path }) => void log(`delete ${path}`),
  clearAll: async () => void log('clearAll'),
  setNotification: async (n) => {
    w.__fakeNative.notification = n;
  },
  requestNotifications: async () => ({ granted: true }),
  addListener: async (_event, listener) => {
    listeners.add(listener);
    return { remove: async () => void listeners.delete(listener) };
  },
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
