/**
 * YouTube helpers shared by the ingest CLI, the Worker and the apps:
 *  - clean "Artist — Title" metadata out of messy video titles,
 *  - recognise links (videos, playlists),
 *  - talk to YouTube's internal search API (InnerTube) and read its answer.
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

/** Playlist id of a playlist link (or of a video link opened inside a playlist). */
export function youtubePlaylistId(input: string): string | null {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^(www|m|music)\./, '');
    if (host !== 'youtube.com' && host !== 'youtu.be') return null;
    const list = url.searchParams.get('list');
    // "RD…" lists are endless auto-generated mixes, not real playlists.
    return list && /^[\w-]{10,}$/.test(list) && !list.startsWith('RD') ? list : null;
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

/* ------------------------------------------------------------------ */
/* Search (InnerTube)                                                  */
/* ------------------------------------------------------------------ */

export type SearchKind = 'songs' | 'videos' | 'playlists';

export interface SearchResult {
  kind: 'video' | 'playlist';
  /** Video id or playlist id. */
  id: string;
  title: string;
  /** Channel / artist. */
  author: string;
  /** Album (YouTube Music songs only). */
  album?: string;
  /** Seconds (videos). */
  duration?: number;
  /** Number of videos (playlists), when known. */
  count?: number;
  thumbnail: string;
  url: string;
}

export interface InnerTubeRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

const WEB_CLIENT = { clientName: 'WEB', clientVersion: '2.20260601.01.00' };
const MUSIC_CLIENT = { clientName: 'WEB_REMIX', clientVersion: '1.20260601.01.00' };

/** Search filters ("params") used by youtube.com / music.youtube.com themselves. */
const PARAMS: Record<SearchKind, string> = {
  songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==',
  videos: 'EgIQAQ==',
  playlists: 'EgIQAw==',
};

export function buildSearchRequest(query: string, kind: SearchKind, lang = 'es'): InnerTubeRequest {
  const music = kind === 'songs';
  const host = music ? 'https://music.youtube.com' : 'https://www.youtube.com';
  return {
    url: `${host}/youtubei/v1/search?prettyPrint=false`,
    headers: {
      'Content-Type': 'application/json',
      Origin: host,
      'X-Youtube-Client-Name': music ? '67' : '1',
      'X-Youtube-Client-Version': (music ? MUSIC_CLIENT : WEB_CLIENT).clientVersion,
    },
    body: JSON.stringify({
      context: { client: { ...(music ? MUSIC_CLIENT : WEB_CLIENT), hl: lang, gl: 'ES' } },
      query,
      params: PARAMS[kind],
    }),
  };
}

type Json = Record<string, unknown>;

/** Every value stored under `key`, anywhere in the tree (YouTube moves things around). */
function findAll(node: unknown, key: string, out: Json[] = []): Json[] {
  if (Array.isArray(node)) for (const n of node) findAll(n, key, out);
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Json)) {
      if (k === key && v && typeof v === 'object') out.push(v as Json);
      else findAll(v, key, out);
    }
  }
  return out;
}

function get(node: unknown, ...path: (string | number)[]): unknown {
  let cur = node;
  for (const p of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[p];
  }
  return cur;
}

/** Text from {simpleText} or {runs:[{text}]} or {content}. */
function text(node: unknown): string {
  if (!node || typeof node !== 'object') return typeof node === 'string' ? node : '';
  const n = node as Json;
  if (typeof n.simpleText === 'string') return n.simpleText;
  if (typeof n.content === 'string') return n.content;
  if (Array.isArray(n.runs))
    return n.runs.map((r) => text(r) || String(get(r, 'text') ?? '')).join('');
  if (typeof n.text === 'string') return n.text;
  return '';
}

/** "1:02:03" → 3723 */
export function parseDuration(value: string): number | undefined {
  if (!/^\d+(:\d{1,2}){1,2}$/.test(value.trim())) return undefined;
  return value
    .trim()
    .split(':')
    .reduce((acc, part) => acc * 60 + Number(part), 0);
}

function bestThumb(node: unknown, fallbackId?: string): string {
  const list = (get(node, 'thumbnails') ?? []) as { url?: string; width?: number }[];
  const best = [...list].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
  if (best) return best.startsWith('//') ? `https:${best}` : best;
  return fallbackId ? `https://i.ytimg.com/vi/${fallbackId}/hqdefault.jpg` : '';
}

const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const playlistUrl = (id: string) => `https://www.youtube.com/playlist?list=${id}`;

/** Reads an InnerTube search answer (youtube.com or music.youtube.com). */
export function parseSearchResponse(json: unknown): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const push = (r: SearchResult) => {
    if (!r.id || !r.title || seen.has(r.kind + r.id)) return;
    seen.add(r.kind + r.id);
    results.push(r);
  };

  for (const v of findAll(json, 'videoRenderer')) {
    const id = String(v.videoId ?? '');
    push({
      kind: 'video',
      id,
      title: text(v.title),
      author: text(v.ownerText) || text(v.longBylineText) || text(v.shortBylineText),
      duration: parseDuration(text(v.lengthText)),
      thumbnail: bestThumb(v.thumbnail, id),
      url: videoUrl(id),
    });
  }

  for (const p of findAll(json, 'playlistRenderer')) {
    const id = String(p.playlistId ?? '');
    const count = Number(String(p.videoCount ?? text(p.videoCountText)).replace(/\D/g, ''));
    push({
      kind: 'playlist',
      id,
      title: text(p.title),
      author: text(p.shortBylineText) || text(p.longBylineText),
      count: Number.isFinite(count) && count > 0 ? count : undefined,
      thumbnail: bestThumb(get(p, 'thumbnails', 0)) || bestThumb(p.thumbnail),
      url: playlistUrl(id),
    });
  }

  // Newer layout for playlists (and sometimes videos).
  for (const l of findAll(json, 'lockupViewModel')) {
    const id = String(l.contentId ?? '');
    const type = String(l.contentType ?? '');
    const meta = get(l, 'metadata', 'lockupMetadataViewModel');
    const title = text(get(meta, 'title'));
    const rows = (get(meta, 'metadata', 'contentMetadataViewModel', 'metadataRows') ??
      []) as unknown[];
    const parts = rows.flatMap((row) =>
      ((get(row, 'metadataParts') ?? []) as unknown[]).map((p) => text(get(p, 'text'))),
    );
    const badge = findAll(l, 'thumbnailBadgeViewModel').map((b) => String(b.text ?? ''))[0] ?? '';
    const image = findAll(l, 'image')[0];
    const thumb = bestThumb(
      image?.sources ? { thumbnails: image.sources } : undefined,
      type.includes('VIDEO') ? id : undefined,
    );
    if (type.includes('PLAYLIST') || type.includes('ALBUM')) {
      const count = Number(badge.replace(/\D/g, ''));
      push({
        kind: 'playlist',
        id,
        title,
        author: parts[0] ?? '',
        count: count > 0 ? count : undefined,
        thumbnail: thumb,
        url: playlistUrl(id),
      });
    } else if (type.includes('VIDEO')) {
      push({
        kind: 'video',
        id,
        title,
        author: parts[0] ?? '',
        duration: parseDuration(badge),
        thumbnail: thumb,
        url: videoUrl(id),
      });
    }
  }

  // YouTube Music rows: title | artist • album • duration
  for (const m of findAll(json, 'musicResponsiveListItemRenderer')) {
    const id = String(
      get(m, 'playlistItemData', 'videoId') ??
        findAll(m, 'watchEndpoint')
          .map((w) => w.videoId)
          .find(Boolean) ??
        '',
    );
    if (!id) continue;
    const columns = ((m.flexColumns ?? []) as unknown[]).map((c) =>
      text(get(c, 'musicResponsiveListItemFlexColumnRenderer', 'text')),
    );
    const details = (columns[1] ?? '').split(' • ').map((s) => s.trim());
    const duration = details.map(parseDuration).find((d) => d !== undefined);
    const rest = details.filter(
      (d) =>
        parseDuration(d) === undefined && !/^(canción|song|abestia|vídeo|video|bideoa)$/i.test(d),
    );
    push({
      kind: 'video',
      id,
      title: columns[0] ?? '',
      author: rest[0] ?? '',
      album: rest[1],
      duration,
      thumbnail: bestThumb(get(m, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail'), id),
      url: videoUrl(id),
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/* Playlist pages (InnerTube browse)                                   */
/* ------------------------------------------------------------------ */

export interface PlaylistEntry {
  id: string;
  title: string;
  author: string;
  /** Seconds, 0 when unknown. */
  duration: number;
}

export interface PlaylistPage {
  title: string;
  author: string;
  entries: PlaylistEntry[];
  /** Token for the next 100 songs, if there are more. */
  continuation: string | null;
}

/** First page of a playlist (`continuation` null) or the next one. */
export function buildBrowseRequest(
  playlistId: string,
  continuation: string | null,
  lang = 'es',
): InnerTubeRequest {
  const host = 'https://www.youtube.com';
  const context = { client: { ...WEB_CLIENT, hl: lang, gl: 'ES' } };
  return {
    url: `${host}/youtubei/v1/browse?prettyPrint=false`,
    headers: {
      'Content-Type': 'application/json',
      Origin: host,
      'X-Youtube-Client-Name': '1',
      'X-Youtube-Client-Version': WEB_CLIENT.clientVersion,
    },
    body: JSON.stringify(
      continuation ? { context, continuation } : { context, browseId: `VL${playlistId}` },
    ),
  };
}

export function parsePlaylistPage(json: unknown): PlaylistPage {
  const entries: PlaylistEntry[] = [];
  const seen = new Set<string>();
  for (const v of findAll(json, 'playlistVideoRenderer')) {
    const id = String(v.videoId ?? '');
    // Deleted / private videos stay in playlists but cannot be played.
    if (!id || seen.has(id) || v.isPlayable === false) continue;
    seen.add(id);
    entries.push({
      id,
      title: text(v.title),
      author: text(v.shortBylineText),
      duration: Number(v.lengthSeconds ?? 0) || parseDuration(text(v.lengthText)) || 0,
    });
  }
  for (const l of findAll(json, 'lockupViewModel')) {
    const id = String(l.contentId ?? '');
    if (!String(l.contentType ?? '').includes('VIDEO') || !id || seen.has(id)) continue;
    seen.add(id);
    const meta = get(l, 'metadata', 'lockupMetadataViewModel');
    const rows = (get(meta, 'metadata', 'contentMetadataViewModel', 'metadataRows') ??
      []) as unknown[];
    const author = text(get(rows[0], 'metadataParts', 0, 'text'));
    const badge = findAll(l, 'thumbnailBadgeViewModel').map((b) => String(b.text ?? ''))[0] ?? '';
    entries.push({
      id,
      title: text(get(meta, 'title')),
      author,
      duration: parseDuration(badge) ?? 0,
    });
  }

  const meta = findAll(json, 'playlistMetadataRenderer')[0];
  const header = findAll(json, 'playlistHeaderRenderer')[0];
  const pageHeader = findAll(json, 'pageHeaderViewModel')[0];
  const title =
    text(meta?.title) ||
    text(header?.title) ||
    text(get(pageHeader, 'title', 'dynamicTextViewModel', 'text'));
  const author = text(header?.ownerText) || text(get(header, 'ownerText'));

  const token =
    findAll(json, 'continuationCommand')
      .map((c) => c.token)
      .find((x) => typeof x === 'string') ??
    findAll(json, 'nextContinuationData')
      .map((c) => c.continuation)
      .find((x) => typeof x === 'string');

  return { title, author, entries, continuation: typeof token === 'string' ? token : null };
}
