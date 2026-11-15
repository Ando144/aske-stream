import { run } from './exec';

export interface ProbeResult {
  codec: string;
  durationMs: number;
  bitrateKbps: number | null;
  tags: Record<string, string>;
  hasAttachedPicture: boolean;
}

interface FfprobeJson {
  format?: { duration?: string; bit_rate?: string; tags?: Record<string, string> };
  streams?: {
    codec_type?: string;
    codec_name?: string;
    bit_rate?: string;
    duration?: string;
    disposition?: { attached_pic?: number };
    tags?: Record<string, string>;
  }[];
}

export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  const data = JSON.parse(stdout) as FfprobeJson;
  const audio = data.streams?.find((s) => s.codec_type === 'audio');
  if (!audio) throw new Error('No audio stream found');
  const seconds = Number(data.format?.duration ?? audio.duration ?? 0);
  const bitrate = Number(audio.bit_rate ?? data.format?.bit_rate ?? 0);
  // Tag keys differ in case between containers (TITLE vs title): normalise.
  const tags: Record<string, string> = {};
  for (const source of [data.format?.tags, audio.tags]) {
    for (const [k, v] of Object.entries(source ?? {})) tags[k.toLowerCase()] = v;
  }
  return {
    codec: audio.codec_name ?? 'unknown',
    durationMs: Math.round(seconds * 1000),
    bitrateKbps: bitrate > 0 ? Math.round(bitrate / 1000) : null,
    tags,
    hasAttachedPicture: !!data.streams?.some((s) => s.disposition?.attached_pic === 1),
  };
}

export type EncodeMode = { kind: 'auto' } | { kind: 'reencode'; bitrateKbps: number };

/** Default bitrate when the source is not Opus (MP3, AAC, FLAC…) and must be transcoded. */
export const DEFAULT_TRANSCODE_KBPS = 128;

/**
 * Produces an Ogg Opus file.
 *  - auto: Opus sources (YouTube's usual format) are remuxed, i.e. the audio
 *    is copied bit-for-bit into an Ogg container. No quality loss, instant.
 *    Other codecs are transcoded once to Opus at 128 kbps.
 *  - reencode: always transcode at the given bitrate (smaller files).
 */
export async function toOpus(
  input: string,
  output: string,
  sourceCodec: string,
  mode: EncodeMode,
): Promise<'remux' | 'transcode'> {
  const remux = mode.kind === 'auto' && sourceCodec === 'opus';
  const codecArgs = remux
    ? ['-c:a', 'copy']
    : [
        '-c:a',
        'libopus',
        '-b:a',
        `${mode.kind === 'reencode' ? mode.bitrateKbps : DEFAULT_TRANSCODE_KBPS}k`,
        '-vbr',
        'on',
        '-application',
        'audio',
      ];
  await run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-map',
    '0:a:0',
    '-vn',
    '-map_metadata',
    '-1',
    ...codecArgs,
    '-f',
    'ogg',
    output,
  ]);
  return remux ? 'remux' : 'transcode';
}

/** Square 512×512 JPEG from a thumbnail or from the picture embedded in an audio file. */
export async function makeCover(input: string, output: string, fromAudio = false): Promise<void> {
  await run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    ...(fromAudio ? ['-map', '0:v:0'] : []),
    '-an',
    '-frames:v',
    '1',
    '-vf',
    "crop='min(iw,ih)':'min(iw,ih)',scale=512:512:flags=lanczos",
    '-q:v',
    '3',
    output,
  ]);
}
