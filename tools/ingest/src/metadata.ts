/**
 * Turns messy YouTube metadata into clean "Artist — Title" pairs.
 * Pure functions, unit-tested.
 */

export interface CleanMetadata {
  title: string;
  artist: string;
  album: string;
}

/** Subset of the yt-dlp info JSON we rely on. */
export interface YtInfo {
  id: string;
  title?: string;
  track?: string | null;
  artist?: string | null;
  artists?: string[] | null;
  creator?: string | null;
  album?: string | null;
  uploader?: string | null;
  channel?: string | null;
  duration?: number | null;
}

const NOISE = [
  'official\\s*(music\\s*|lyrics?\\s*|4k\\s*|hd\\s*)?video',
  'official\\s*(audio|visuali[sz]er)',
  'music\\s*video',
  'lyrics?(\\s*video)?',
  'audio(\\s*oficial)?',
  'visuali[sz]er',
  'video\\s*(clip\\s*)?oficial',
  'videoclip(\\s*oficial)?',
  'v[ií]deo\\s*oficial',
  'letra',
  'bideoklipa',
  'hd|hq|4k',
  'remaster(ed)?(\\s*\\d{4})?',
  '(\\d{4}\\s*)?remaster(ed)?',
  'explicit|clean',
];

const NOISE_IN_BRACKETS = new RegExp(`\\s*[(\\[](?:${NOISE.join('|')})[)\\]]`, 'gi');
const TRAILING_NOISE = new RegExp(`\\s*[|/]\\s*(?:${NOISE.join('|')}).*$`, 'i');
const SEPARATOR = /\s+[-–—]\s+/;

export function cleanTitle(raw: string): string {
  return raw
    .replace(NOISE_IN_BRACKETS, '')
    .replace(TRAILING_NOISE, '')
    .replace(/\s*[(\[]\s*[)\]]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

export function cleanArtist(raw: string): string {
  return raw
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s*\(official\)$/i, '')
    .trim();
}

export function metadataFromYoutube(info: YtInfo): CleanMetadata {
  const album = (info.album ?? '').trim();

  // YouTube Music / auto-generated "Topic" uploads carry proper fields.
  const tagArtist = info.artists?.length ? info.artists.join(', ') : info.artist || info.creator;
  if (info.track && tagArtist) {
    return { title: cleanTitle(info.track), artist: cleanArtist(tagArtist), album };
  }

  const title = cleanTitle(info.title ?? info.id);
  const parts = title.split(SEPARATOR);
  if (parts.length >= 2 && parts[0]!.length <= 80) {
    return {
      artist: cleanArtist(parts[0]!),
      title: cleanTitle(parts.slice(1).join(' - ')),
      album,
    };
  }
  return { title, artist: cleanArtist(info.uploader ?? info.channel ?? ''), album };
}

/** Accepts watch, short, music and youtu.be links; returns null for anything else. */
export function youtubeVideoId(input: string): string | null {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtu.be') return url.pathname.slice(1) || null;
    if (host !== 'youtube.com') return null;
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const short = url.pathname.match(/^\/(shorts|live|embed)\/([\w-]{6,})/);
    return short?.[2] ?? null;
  } catch {
    return null;
  }
}

export function isYoutubeUrl(input: string): boolean {
  try {
    const host = new URL(input).hostname.replace(/^(www|m|music)\./, '');
    return host === 'youtube.com' || host === 'youtu.be';
  } catch {
    return false;
  }
}
