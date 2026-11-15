import { openAsBlob } from 'node:fs';
import type { IngestMetadata, Track, TrackSource } from '@aske/shared';

export interface ApiConfig {
  url: string;
  accessKey: string;
}

const headers = (cfg: ApiConfig) => ({ Authorization: `Bearer ${cfg.accessKey}` });

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    return data.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function checkConnection(cfg: ApiConfig): Promise<void> {
  const res = await fetch(new URL('/api/ingest/exists?source=file&ref=ping', cfg.url), {
    headers: headers(cfg),
  });
  if (res.status === 401) throw new Error('The server rejected ASKE_ACCESS_KEY');
  if (!res.ok) throw new Error(`Cannot reach ${cfg.url}: ${await errorMessage(res)}`);
}

export async function alreadyUploaded(
  cfg: ApiConfig,
  source: TrackSource,
  ref: string,
): Promise<boolean> {
  const url = new URL('/api/ingest/exists', cfg.url);
  url.searchParams.set('source', source);
  url.searchParams.set('ref', ref);
  const res = await fetch(url, { headers: headers(cfg) });
  if (!res.ok) throw new Error(await errorMessage(res));
  return ((await res.json()) as { exists: boolean }).exists;
}

export async function uploadTrack(
  cfg: ApiConfig,
  meta: IngestMetadata,
  audioPath: string,
  coverPath: string | null,
): Promise<Track> {
  const form = new FormData();
  form.set('meta', JSON.stringify(meta));
  form.set('audio', await openAsBlob(audioPath, { type: 'audio/ogg' }), 'audio.opus');
  if (coverPath)
    form.set('cover', await openAsBlob(coverPath, { type: 'image/jpeg' }), 'cover.jpg');
  const res = await fetch(new URL('/api/ingest/tracks', cfg.url), {
    method: 'POST',
    headers: headers(cfg),
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await errorMessage(res)}`);
  return (await res.json()) as Track;
}
