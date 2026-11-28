// Shared types for the download queue (no stores, no Capacitor).
import type { YtInfo } from '@aske/shared/youtube';

export type JobStatus =
  | 'queued' // waiting for the phone's downloader (native queue)
  | 'downloading' // native is downloading it (progress 0-100)
  | 'downloaded' // audio file ready on the phone, waiting to be saved to the library
  | 'saving'
  | 'done'
  | 'skipped'
  | 'error'
  | 'canceled';

export type NativeInfo = YtInfo & { duration?: number; abr?: number; acodec?: string };

export interface DownloadedFile {
  path: string;
  bytes: number;
  ext: string;
  info: NativeInfo;
}

export interface JobTimings {
  downloadMs?: number; // native, from start to file ready
  readMs?: number; // reading the file into the WebView
  coverMs?: number;
  uploadMs?: number; // Drive/Cloudflare upload or device write
  libraryMs?: number; // upsert + playlist sync
}

export interface DownloadJob {
  id: string;
  /** Cloudflare id of the next upload, renewed on retry; the first one uses `id`. */
  uploadId?: string;
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  status: JobStatus;
  /** 0–100 while downloading. */
  progress: number;
  error?: string;
  /** Library playlist the song is added to when it is ready. */
  playlistId?: string | null;
  /** Group of songs queued together; drives the "1 of N" notification. Older jobs have none. */
  batchId?: string;
  /** "Send to phone" item this job comes from. */
  sendId?: string | null;
  /** Cloudflare library: also keep the file on this phone. */
  keepOffline: boolean;
  trackId?: string;
  createdAt: number;
  finishedAt?: number;
  /** Save attempts already failed (network). */
  attempts?: number;
  /** Epoch ms; do not try to save before this. */
  retryAt?: number;
  /** Server errors or timeouts while uploading a big file. */
  serverFailures?: number;
  /** Epoch ms when the current save started. */
  savingSince?: number;
  /** Where the file is saved; 'device-only' when it cannot go to the cloud library. */
  target?: 'home' | 'device-only';
  /** Set when status becomes 'downloaded'. */
  file?: DownloadedFile;
  timings?: JobTimings;
}

export interface NativeJob {
  jobId: string;
  videoId: string;
  /** At most 200 characters; shown by the phone when the app is closed. */
  title?: string;
}

export interface NativeResult {
  jobId: string;
  ok: boolean;
  path?: string;
  bytes?: number;
  ext?: string;
  info?: NativeInfo; // when ok
  elapsedMs?: number; // when ok
  error?: string; // when !ok (short yt-dlp line)
  code?: 'download_failed' | 'network' | 'canceled' | 'init_failed';
}

export interface NativePending {
  queued: string[]; // jobIds waiting in the native queue, in order
  current: string | null; // jobId being downloaded now
  results: NativeResult[]; // finished and not yet acknowledged
  waitingNetwork: boolean;
}

export interface NotificationTemplates {
  progress: string;
  waiting: string;
  openToSave: string;
  openToSaveOne: string;
  /** Shown by the phone when Android stops the downloads for time (onTimeout). */
  paused: string;
}
