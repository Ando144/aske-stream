import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './exec';
import type { YtInfo } from './metadata';

export interface PlaylistEntry {
  id: string;
  url: string;
  title: string;
}

/** Expands a video or playlist URL into individual videos without downloading anything. */
export async function listEntries(url: string): Promise<PlaylistEntry[]> {
  const { stdout } = await run('yt-dlp', [
    '--flat-playlist',
    '--dump-single-json',
    '--no-warnings',
    url,
  ]);
  const data = JSON.parse(stdout) as {
    _type?: string;
    id: string;
    title?: string;
    webpage_url?: string;
    entries?: { id: string; title?: string; url?: string }[];
  };
  if (data._type === 'playlist' && data.entries) {
    return data.entries
      .filter((e) => e.id)
      .map((e) => ({
        id: e.id,
        title: e.title ?? e.id,
        url: `https://www.youtube.com/watch?v=${e.id}`,
      }));
  }
  return [{ id: data.id, title: data.title ?? data.id, url: data.webpage_url ?? url }];
}

export interface Downloaded {
  info: YtInfo;
  audioPath: string;
  thumbnailPath: string | null;
}

/**
 * Downloads the best audio-only stream (Opus when available) plus the
 * thumbnail. Runs on YOUR machine: YouTube blocks most datacenter IPs, which
 * is why this is a local tool instead of a server feature.
 */
export async function downloadAudio(url: string, workDir: string): Promise<Downloaded> {
  const { stdout } = await run('yt-dlp', [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '-f',
    'bestaudio[acodec=opus]/bestaudio',
    '-o',
    join(workDir, '%(id)s.%(ext)s'),
    '--write-thumbnail',
    '--convert-thumbnails',
    'jpg',
    '--dump-json',
    '--no-simulate',
    url,
  ]);
  const info = JSON.parse(stdout.trim().split('\n').pop()!) as YtInfo & { ext?: string };
  const files = await readdir(workDir);
  const audio = files.find((f) => f.startsWith(`${info.id}.`) && !f.endsWith('.jpg'));
  if (!audio) throw new Error('yt-dlp finished but no audio file was found');
  const thumb = files.find((f) => f.startsWith(`${info.id}.`) && f.endsWith('.jpg'));
  return {
    info,
    audioPath: join(workDir, audio),
    thumbnailPath: thumb ? join(workDir, thumb) : null,
  };
}
