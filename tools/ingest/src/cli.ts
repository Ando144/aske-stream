#!/usr/bin/env -S npx tsx
/**
 * aske-ingest — add music to your aske-stream library.
 *
 *   npm run ingest -- <YouTube video/playlist URL | audio file | folder> [...more]
 *
 * Every input becomes an Ogg Opus file with clean metadata and a square
 * cover, uploaded through the API (ASKE_URL + ASKE_ACCESS_KEY in .env).
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { IngestMetadata } from '@aske/shared';
import { makeCover, probe, toOpus, type EncodeMode } from './audio';
import { loadConfig } from './config';
import { isAvailable } from './exec';
import { cleanTitle, isYoutubeUrl, metadataFromYoutube } from './metadata';
import { alreadyUploaded, checkConnection, uploadTrack, type ApiConfig } from './upload';
import { downloadAudio, listEntries } from './youtube';

/** npm runs workspace scripts from tools/ingest; resolve user paths from where they typed the command. */
const userCwd = process.env.INIT_CWD ?? process.cwd();

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.wav',
  '.ogg',
  '.opus',
  '.webm',
  '.wma',
  '.alac',
  '.aiff',
]);

const HELP = `
Usage: npm run ingest -- [options] <input...>

Inputs:
  https://www.youtube.com/watch?v=…     a video
  https://www.youtube.com/playlist?list=…  every video of a playlist
  ./song.mp3 | ./Music/                  local files or folders (recursive)

Options:
  --bitrate <kbps>   Re-encode to Opus at this bitrate (e.g. 96) instead of the
                     default lossless remux of YouTube's Opus stream.
  --artist <name>    Override the artist (local files)
  --album <name>     Override the album
  --dry-run          Convert only, do not upload (keeps files in ./.ingest-out)
  -h, --help         Show this help

Requirements: ffmpeg + ffprobe, and yt-dlp for YouTube links.
  Windows:  winget install Gyan.FFmpeg yt-dlp.yt-dlp DenoLand.Deno
  macOS:    brew install ffmpeg yt-dlp deno
`;

interface Job {
  label: string;
  kind: 'youtube' | 'file';
  ref: string; // video id or file path
  url?: string;
}

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function walk(path: string): Promise<string[]> {
  const info = await stat(path);
  if (info.isFile()) return AUDIO_EXTENSIONS.has(extname(path).toLowerCase()) ? [path] : [];
  const out: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    out.push(...(await walk(join(path, entry.name))));
  }
  return out.sort();
}

async function expandInputs(inputs: string[]): Promise<Job[]> {
  const jobs: Job[] = [];
  for (const input of inputs) {
    if (isYoutubeUrl(input)) {
      process.stdout.write(c.dim(`Reading ${input}… `));
      const entries = await listEntries(input);
      console.log(c.dim(`${entries.length} video(s)`));
      for (const e of entries)
        jobs.push({ label: e.title, kind: 'youtube', ref: e.id, url: e.url });
    } else {
      for (const file of await walk(resolve(userCwd, input))) {
        jobs.push({ label: basename(file), kind: 'file', ref: file });
      }
    }
  }
  return jobs;
}

async function processJob(
  job: Job,
  workDir: string,
  mode: EncodeMode,
  overrides: { artist?: string; album?: string },
): Promise<{ meta: IngestMetadata; audio: string; cover: string | null; how: string }> {
  let source: string;
  let coverSource: { path: string; fromAudio: boolean } | null = null;
  let meta: Omit<IngestMetadata, 'durationMs' | 'bitrateKbps'>;

  if (job.kind === 'youtube') {
    const dl = await downloadAudio(job.url!, workDir);
    source = dl.audioPath;
    if (dl.thumbnailPath) coverSource = { path: dl.thumbnailPath, fromAudio: false };
    meta = { ...metadataFromYoutube(dl.info), source: 'youtube', sourceRef: dl.info.id };
  } else {
    source = job.ref;
    const tags = (await probe(source)).tags;
    meta = {
      title: cleanTitle(tags.title || basename(source, extname(source))),
      artist: tags.artist || tags.album_artist || '',
      album: tags.album || '',
      source: 'file',
      sourceRef: await sha256(source),
    };
  }
  if (overrides.artist) meta.artist = overrides.artist;
  if (overrides.album) meta.album = overrides.album;

  const info = await probe(source);
  if (!coverSource && info.hasAttachedPicture) coverSource = { path: source, fromAudio: true };

  const audio = join(workDir, 'audio.opus');
  const how = await toOpus(source, audio, info.codec, mode);
  const out = await probe(audio);

  let cover: string | null = null;
  if (coverSource) {
    cover = join(workDir, 'cover.jpg');
    try {
      await makeCover(coverSource.path, cover, coverSource.fromAudio);
    } catch {
      cover = null; // a broken thumbnail should never block the song
    }
  }

  return {
    meta: { ...meta, durationMs: out.durationMs || info.durationMs, bitrateKbps: out.bitrateKbps },
    audio,
    cover,
    how: how === 'remux' ? 'remux (no re-encode)' : `opus ${out.bitrateKbps ?? '?'} kbps`,
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      bitrate: { type: 'string' },
      artist: { type: 'string' },
      album: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  let mode: EncodeMode = { kind: 'auto' };
  if (values.bitrate) {
    const kbps = Number(values.bitrate);
    if (!Number.isInteger(kbps) || kbps < 32 || kbps > 256)
      throw new Error('--bitrate must be 32–256');
    mode = { kind: 'reencode', bitrateKbps: kbps };
  }

  for (const bin of ['ffmpeg', 'ffprobe']) {
    if (!(await isAvailable(bin))) throw new Error(`${bin} is required.\n${HELP}`);
  }
  if (positionals.some(isYoutubeUrl) && !(await isAvailable('yt-dlp', '--version'))) {
    throw new Error(`yt-dlp is required for YouTube links.\n${HELP}`);
  }

  const dryRun = values['dry-run'];
  let cfg: ApiConfig | null = null;
  if (!dryRun) {
    cfg = loadConfig();
    await checkConnection(cfg);
    console.log(c.dim(`Uploading to ${cfg.url}`));
  }

  const jobs = await expandInputs(positionals);
  if (jobs.length === 0) throw new Error('No audio found in the given inputs');

  const tmpRoot = await mkdtemp(join(tmpdir(), 'aske-ingest-'));
  const outDir = resolve(userCwd, '.ingest-out');
  const stats = { added: 0, skipped: 0, failed: 0 };

  try {
    for (const [i, job] of jobs.entries()) {
      const prefix = c.dim(`[${i + 1}/${jobs.length}]`);
      try {
        if (cfg && job.kind === 'youtube' && (await alreadyUploaded(cfg, 'youtube', job.ref))) {
          console.log(
            `${prefix} ${c.yellow('skip')} ${job.label} ${c.dim('(already in library)')}`,
          );
          stats.skipped++;
          continue;
        }
        const workDir = join(tmpRoot, String(i));
        await mkdir(workDir, { recursive: true });
        const result = await processJob(job, workDir, mode, values);

        if (
          cfg &&
          job.kind === 'file' &&
          (await alreadyUploaded(cfg, 'file', result.meta.sourceRef!))
        ) {
          console.log(
            `${prefix} ${c.yellow('skip')} ${job.label} ${c.dim('(already in library)')}`,
          );
          stats.skipped++;
          continue;
        }

        const name = `${result.meta.artist ? `${result.meta.artist} — ` : ''}${result.meta.title}`;
        if (cfg) {
          await uploadTrack(cfg, result.meta, result.audio, result.cover);
          console.log(`${prefix} ${c.green('added')} ${c.bold(name)} ${c.dim(result.how)}`);
        } else {
          await mkdir(outDir, { recursive: true });
          const { copyFile } = await import('node:fs/promises');
          const safe = name.replace(/[<>:"/\\|?*]+/g, '_').slice(0, 120);
          await copyFile(result.audio, join(outDir, `${safe}.opus`));
          console.log(`${prefix} ${c.green('converted')} ${c.bold(name)} ${c.dim(result.how)}`);
        }
        stats.added++;
      } catch (err) {
        stats.failed++;
        console.log(
          `${prefix} ${c.red('failed')} ${job.label}\n    ${c.dim((err as Error).message)}`,
        );
      }
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }

  console.log(
    `\n${c.green(`${stats.added} ${dryRun ? 'converted' : 'added'}`)}, ${c.yellow(`${stats.skipped} skipped`)}, ${
      stats.failed ? c.red(`${stats.failed} failed`) : '0 failed'
    }${dryRun ? c.dim(` — files in ${outDir}`) : ''}`,
  );
  if (stats.failed) process.exitCode = 1;
}

main().catch((err: Error) => {
  console.error(c.red(`Error: ${err.message}`));
  process.exit(1);
});
