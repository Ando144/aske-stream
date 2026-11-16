import { CapacitorHttp, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { YtInfo } from '@aske/shared/youtube';
import {
  buildBrowseRequest,
  buildSearchRequest,
  parsePlaylistPage,
  parseSearchResponse,
  youtubePlaylistId,
  type PlaylistEntry,
  type SearchKind,
  type SearchResult,
} from '@aske/shared/youtube';

/** apps/mobile/android/.../DownloaderPlugin.java (yt-dlp on the phone). */
export interface DownloaderPlugin {
  init(): Promise<{ version: string }>;
  updateEngine(): Promise<{ updated: boolean; version: string }>;
  list(options: { url: string }): Promise<{
    title: string;
    uploader: string;
    entries: { id: string; title: string; uploader: string; duration: number }[];
  }>;
  download(options: { jobId: string; videoId: string }): Promise<{
    path: string;
    bytes: number;
    ext: string;
    info: YtInfo & { duration?: number; abr?: number; acodec?: string };
  }>;
  cancel(options: { jobId: string }): Promise<{ canceled: boolean }>;
  fetchImage(options: { url: string; jobId: string }): Promise<{ path: string }>;
  deleteFile(options: { path: string }): Promise<void>;
  clearAll(): Promise<void>;
  setNotification(options: {
    active: boolean;
    title?: string;
    text?: string;
    progress?: number;
  }): Promise<void>;
  requestNotifications(): Promise<{ granted: boolean }>;
  addListener(
    event: 'progress',
    listener: (p: { jobId: string; progress: number; eta: number }) => void,
  ): Promise<PluginListenerHandle>;
}

export const Downloader = registerPlugin<DownloaderPlugin>('Downloader');

/**
 * Search from the phone. Asks YouTube's own search API directly (fast, like
 * the YouTube app); if YouTube changes it and nothing comes back, falls back
 * to yt-dlp's search, which is slower but kept up to date by its maintainers.
 */
export async function searchOnPhone(
  query: string,
  kind: SearchKind,
  lang: string,
): Promise<SearchResult[]> {
  try {
    const req = buildSearchRequest(query, kind, lang);
    const res = await CapacitorHttp.post({
      url: req.url,
      headers: req.headers,
      data: JSON.parse(req.body),
      responseType: 'json',
      connectTimeout: 10_000,
      readTimeout: 15_000,
    });
    if (res.status === 200) {
      const results = parseSearchResponse(res.data);
      if (results.length) return results;
    }
  } catch {
    // fall back below
  }
  if (kind === 'playlists') return [];
  const list = await Downloader.list({ url: `ytsearch20:${query}` });
  return list.entries.map((e) => ({
    kind: 'video' as const,
    id: e.id,
    title: e.title,
    author: e.uploader,
    duration: e.duration || undefined,
    thumbnail: `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${e.id}`,
  }));
}

export interface PlaylistListing {
  title: string;
  author: string;
  entries: PlaylistEntry[];
}

/** At most 2 000 songs (20 pages) are read from one playlist. */
const MAX_PAGES = 20;
const YTDLP_LIST_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

/**
 * Lists a playlist from the phone. Like search: YouTube's own API first
 * (a second or two, 100 songs per page), yt-dlp as the backup.
 */
export async function listPlaylistOnPhone(url: string, lang = 'es'): Promise<PlaylistListing> {
  const id = youtubePlaylistId(url);
  if (id) {
    try {
      let title = '';
      let author = '';
      const entries: PlaylistEntry[] = [];
      let continuation: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const req = buildBrowseRequest(id, continuation, lang);
        const res = await CapacitorHttp.post({
          url: req.url,
          headers: req.headers,
          data: JSON.parse(req.body),
          responseType: 'json',
          connectTimeout: 10_000,
          readTimeout: 20_000,
        });
        if (res.status !== 200) break;
        const parsed = parsePlaylistPage(res.data);
        if (page === 0) ({ title, author } = parsed);
        const known = new Set(entries.map((e) => e.id));
        entries.push(...parsed.entries.filter((e) => !known.has(e.id)));
        continuation = parsed.continuation;
        if (!continuation || parsed.entries.length === 0) break;
      }
      if (entries.length) return { title, author, entries };
    } catch {
      // fall back to yt-dlp
    }
  }
  const list = await withTimeout(Downloader.list({ url }), YTDLP_LIST_TIMEOUT_MS);
  return {
    title: list.title,
    author: list.uploader,
    entries: list.entries.map((e) => ({
      id: e.id,
      title: e.title,
      author: e.uploader,
      duration: e.duration || 0,
    })),
  };
}
