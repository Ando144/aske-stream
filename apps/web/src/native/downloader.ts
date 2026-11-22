import { CapacitorHttp, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type {
  NativeJob,
  NativePending,
  NativeResult,
  NotificationTemplates,
} from '../downloads/types';
import {
  emptyRead,
  listingFromRead,
  readPages,
  type PageFetcher,
  type PlaylistListing,
  type PlaylistRead,
} from '../downloads/playlistReader';
import { withTimeout } from '../lib/timeout';
import {
  buildBrowseRequest,
  buildSearchRequest,
  isPlaylistComplete,
  parsePlaylistPage,
  pickLongerList,
  parseSearchResponse,
  youtubePlaylistId,
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
  /** Appends jobs to the phone's own queue (dedupe by jobId) and starts the service. */
  queue(options: { jobs: NativeJob[]; texts: NotificationTemplates }): Promise<void>;
  /** What the phone has queued, is downloading and finished (also while the app was closed). */
  pending(): Promise<NativePending>;
  /** Forgets a finished job's result and deletes its folder. */
  ack(options: { jobId: string }): Promise<void>;
  cancel(options: { jobId: string }): Promise<{ canceled: boolean }>;
  fetchImage(options: { url: string; jobId: string }): Promise<{ path: string }>;
  deleteFile(options: { path: string }): Promise<void>;
  setNotification(options: {
    active: boolean;
    title?: string;
    text?: string;
    /** Total progress of the batch, 0-100; -1 = indeterminate bar. */
    progress?: number;
    /** Only with active:false; if not empty the phone shows the final notice. */
    doneText?: string;
  }): Promise<void>;
  /** Removes the final "downloads finished" notice if present. */
  clearDoneNotice(): Promise<void>;
  requestNotifications(): Promise<{ granted: boolean }>;
  addListener(
    event: 'progress',
    listener: (p: { jobId: string; progress: number; eta: number }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'finished',
    listener: (r: NativeResult) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'network',
    listener: (p: { waiting: boolean }) => void,
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

export type { PlaylistListing } from '../downloads/playlistReader';

/** At most 2 000 songs (20 pages) are read from one playlist. */
const MAX_PAGES = 20;
const INNERTUBE_TIMEOUT_MS = 30_000;
const YTDLP_LIST_TIMEOUT_MS = 120_000;

async function readViaInnerTube(id: string, lang: string): Promise<PlaylistRead> {
  const fetchPage: PageFetcher = async (continuation) => {
    const req = buildBrowseRequest(id, continuation, lang);
    const res = await CapacitorHttp.post({
      url: req.url,
      headers: req.headers,
      data: JSON.parse(req.body),
      responseType: 'json',
      connectTimeout: 10_000,
      readTimeout: 20_000,
    });
    return res.status === 200 ? parsePlaylistPage(res.data) : null;
  };
  const read = emptyRead();
  try {
    await withTimeout(readPages(fetchPage, read, { maxPages: MAX_PAGES }), INNERTUBE_TIMEOUT_MS);
  } catch {
    // keep whatever was read; yt-dlp may complete it below
  }
  return read;
}

/**
 * Lists a playlist from the phone. Like search: YouTube's own API first (a second or two,
 * 100 songs per page), yt-dlp when that fails or stops short of the announced count.
 * `onPartial` is called with the songs already read while yt-dlp is still working.
 */
export async function listPlaylistOnPhone(
  url: string,
  lang = 'es',
  onPartial?: (partial: PlaylistListing) => void,
): Promise<PlaylistListing> {
  const id = youtubePlaylistId(url);
  const inner = id ? await readViaInnerTube(id, lang) : emptyRead();
  const innerEntries = inner.entries;
  const totalCount = inner.totalCount;
  const fromInner = listingFromRead(inner);
  if (innerEntries.length && fromInner.complete) return fromInner;

  if (innerEntries.length) onPartial?.(fromInner);
  try {
    const list = await withTimeout(Downloader.list({ url }), YTDLP_LIST_TIMEOUT_MS);
    const backup = list.entries.map((e) => ({
      id: e.id,
      title: e.title,
      author: e.uploader,
      duration: e.duration || 0,
    }));
    const entries = pickLongerList(innerEntries, backup);
    return {
      title: fromInner.title || list.title,
      author: fromInner.author || list.uploader,
      entries,
      totalCount,
      complete: isPlaylistComplete(entries.length, totalCount, false),
      unavailable: inner.skipped,
    };
  } catch (err) {
    // A partial list is still useful; the sheet tells the user it is incomplete.
    if (innerEntries.length) return fromInner;
    throw err;
  }
}
