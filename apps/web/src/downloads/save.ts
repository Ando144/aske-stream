import { Capacitor } from '@capacitor/core';
import { LIMITS } from '@aske/shared';
import { metadataFromYoutube } from '@aske/shared/youtube';
import { api, ApiError } from '../api/client';
import { squareJpeg } from '../lib/cover';
import { Downloader } from '../native/downloader';
import { deleteDeviceFile, saveDeviceFile } from '../storage/deviceFiles';
import { driveHome } from '../storage/drive/home';
import { deviceHome, fromRemote, newLocalId } from '../storage/homes';
import type { LocalTrack } from '../storage/types';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { findInLibrary } from './imports';
import type { HomeKind } from './pipeline';
import type { DownloadedFile, DownloadJob, JobTimings } from './types';

export type SaveOutcome =
  | { kind: 'saved'; track: LocalTrack; timings: JobTimings }
  | { kind: 'duplicate'; trackId: string | undefined };

/** Assumes at least 16 KB/s of upload speed, and never less than two minutes. */
export function uploadTimeoutMs(bytes: number): number {
  return Math.max(120_000, (bytes / 16_384) * 1000);
}

function mimeFor(ext: string): string {
  if (ext === 'webm' || ext === 'weba') return 'audio/webm';
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4';
  return 'audio/ogg';
}

async function readNativeFile(path: string): Promise<Blob> {
  const res = await fetch(Capacitor.convertFileSrc(path));
  if (!res.ok) throw new Error(`Could not read the downloaded file (${res.status})`);
  return res.blob();
}

async function fetchCover(job: DownloadJob): Promise<{ blob: Blob | null; paths: string[] }> {
  const paths: string[] = [];
  for (const name of ['maxresdefault', 'hqdefault']) {
    try {
      const { path } = await Downloader.fetchImage({
        url: `https://i.ytimg.com/vi/${job.videoId}/${name}.jpg`,
        jobId: job.id,
      });
      paths.push(path);
      const square = await squareJpeg(await readNativeFile(path));
      if (square && square.size <= LIMITS.coverMaxBytes) return { blob: square, paths };
    } catch {
      // try the next size
    }
  }
  return { blob: null, paths };
}

const timed = async <T>(work: () => Promise<T>): Promise<{ value: T; ms: number }> => {
  const start = Date.now();
  const value = await work();
  return { value, ms: Date.now() - start };
};

interface Prepared {
  job: DownloadJob;
  audio: File;
  cover: Blob | null;
  coverPaths: string[];
  mime: string;
  durationMs: number;
  bitrateKbps: number | null;
  meta: ReturnType<typeof metadataFromYoutube>;
  timings: JobTimings;
}

async function prepare(job: DownloadJob, file: DownloadedFile): Promise<Prepared> {
  const meta = metadataFromYoutube({ ...file.info, id: job.videoId });
  const durationMs = Math.round((file.info.duration ?? 0) * 1000);
  if (durationMs <= 0) throw new Error('Unknown duration');
  const mime = mimeFor(file.ext);
  const [read, cover] = await Promise.all([
    timed(
      async () =>
        new File([await readNativeFile(file.path)], `${job.videoId}.${file.ext}`, { type: mime }),
    ),
    timed(() => fetchCover(job)),
  ]);
  const audio = read.value;
  const bitrateKbps =
    Math.round(file.info.abr ?? 0) || Math.round((audio.size * 8) / durationMs) || null;
  return {
    job,
    audio,
    cover: cover.value.blob,
    coverPaths: cover.value.paths,
    mime,
    durationMs,
    bitrateKbps,
    meta,
    timings: { readMs: read.ms, coverMs: cover.ms },
  };
}

/** Only the cover files: the audio stays until the store acknowledges the save. */
async function deleteCoverFiles(paths: string[]): Promise<void> {
  for (const path of paths) await Downloader.deleteFile({ path }).catch(() => undefined);
}

async function finish(
  p: Prepared,
  track: LocalTrack,
  uploadMs: number,
  keepCopy: boolean,
): Promise<SaveOutcome> {
  const library = await timed(async () => {
    useLibrary.getState().upsertTracks([track]);
    if (keepCopy && p.job.keepOffline) {
      await useOffline.getState().adopt(track.id, p.audio, p.durationMs);
    }
  });
  return { kind: 'saved', track, timings: { ...p.timings, uploadMs, libraryMs: library.ms } };
}

async function saveToCloudflare(p: Prepared): Promise<SaveOutcome> {
  if (p.mime === 'audio/mp4') throw new Error('Only Opus audio can be stored in Cloudflare');
  if (!navigator.onLine) throw new ApiError(0, 'network_error', 'No connection');
  const { job, meta } = p;
  const form = new FormData();
  form.append(
    'meta',
    JSON.stringify({
      title: meta.title.slice(0, LIMITS.titleMax) || job.title,
      artist: meta.artist.slice(0, LIMITS.titleMax),
      album: meta.album.slice(0, LIMITS.titleMax),
      durationMs: p.durationMs,
      bitrateKbps: p.bitrateKbps,
      source: 'youtube',
      sourceRef: job.videoId,
      kind: 'music',
    }),
  );
  form.append('audio', p.audio);
  if (p.cover) form.append('cover', new File([p.cover], 'cover.jpg', { type: 'image/jpeg' }));
  try {
    const upload = await timed(() =>
      api.uploadTrack(form, AbortSignal.timeout(uploadTimeoutMs(p.audio.size))),
    );
    return finish(p, fromRemote(upload.value), upload.ms, true);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      await useLibrary.getState().load();
      return { kind: 'duplicate', trackId: findInLibrary(job.videoId)?.id };
    }
    throw err;
  }
}

async function saveToDrive(p: Prepared): Promise<SaveOutcome> {
  if (!navigator.onLine) throw new ApiError(0, 'network_error', 'No connection');
  const { job, meta } = p;
  const upload = await timed(() =>
    driveHome.addTrack(
      {
        title: meta.title || job.title,
        artist: meta.artist,
        album: meta.album,
        durationMs: p.durationMs,
        sizeBytes: p.audio.size,
        bitrateKbps: p.bitrateKbps,
        hasCover: !!p.cover,
        kind: 'music',
        source: 'youtube',
        sourceRef: job.videoId,
        mime: p.mime,
      },
      p.audio,
      p.cover,
    ),
  );
  return finish(p, upload.value, upload.ms, true);
}

async function saveToDevice(p: Prepared): Promise<SaveOutcome> {
  const { job, meta } = p;
  const id = newLocalId();
  try {
    const write = await timed(async () => {
      await saveDeviceFile('audio', id, p.audio);
      if (p.cover) await saveDeviceFile('covers', id, p.cover);
      return deviceHome.addTrack({
        id,
        title: meta.title || job.title,
        artist: meta.artist,
        album: meta.album,
        durationMs: p.durationMs,
        sizeBytes: p.audio.size,
        bitrateKbps: p.bitrateKbps,
        hasCover: !!p.cover,
        kind: 'music',
        source: 'youtube',
        sourceRef: job.videoId,
        likedAt: null,
        createdAt: Date.now(),
        locations: { device: true },
        mime: p.mime,
      });
    });
    return await finish(p, write.value, write.ms, false);
  } catch (err) {
    await deleteDeviceFile('audio', id).catch(() => undefined);
    await deleteDeviceFile('covers', id).catch(() => undefined);
    throw err;
  }
}

const SAVERS: Record<HomeKind, (p: Prepared) => Promise<SaveOutcome>> = {
  cloudflare: saveToCloudflare,
  drive: saveToDrive,
  device: saveToDevice,
};

/** Saves a downloaded file into the library's home. Throws on failure; keeps the native file. */
export async function saveDownloaded(
  job: DownloadJob,
  file: DownloadedFile,
  home: HomeKind,
): Promise<SaveOutcome> {
  const prepared = await prepare(job, file);
  try {
    return await SAVERS[home](prepared);
  } finally {
    await deleteCoverFiles(prepared.coverPaths);
  }
}
