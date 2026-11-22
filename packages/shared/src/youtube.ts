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

/** Real playlist id; "RD…" lists are endless auto-generated mixes, not real playlists. */
export function isPlaylistId(id: string): boolean {
  return /^[\w-]{10,64}$/.test(id) && !id.startsWith('RD');
}

/** Playlist id of a playlist link (or of a video link opened inside a playlist). */
export function youtubePlaylistId(input: string): string | null {
  const link = classifyPlaylistLink(input);
  return link.kind === 'playlist' ? link.id : null;
}

export type PlaylistLink =
  | { kind: 'playlist'; id: string }
  | { kind: 'mix' } // list=RD… (automatic mixes)
  | { kind: 'personal' } // list=LL, LM or WL ("Liked", "Watch later")
  | { kind: 'none' }; // not YouTube or no list= at all

export function classifyPlaylistLink(input: string): PlaylistLink {
  if (!isYoutubeUrl(input)) return { kind: 'none' };
  const list = new URL(input).searchParams.get('list');
  if (!list) return { kind: 'none' };
  if (list.startsWith('RD')) return { kind: 'mix' };
  if (list === 'LL' || list === 'LM' || list === 'WL') return { kind: 'personal' };
  return isPlaylistId(list) ? { kind: 'playlist', id: list } : { kind: 'none' };
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

/** Playlist id of an album lockup (`MPRE…` content ids are not playlists; `OLAK5uy…` ones are). */
function albumPlaylistId(l: Json): string | null {
  for (const key of ['watchPlaylistEndpoint', 'watchEndpoint']) {
    const id = findAll(l, key)
      .map((e) => e.playlistId)
      .find((x): x is string => typeof x === 'string' && x.startsWith('OLAK5uy'));
    if (id) return id;
  }
  return null;
}

/** First image that really has sources (the first `image` of a lockup may be an empty one). */
function lockupThumb(l: Json, videoId: string | undefined): string {
  const image = findAll(l, 'image').find((i) => Array.isArray(i.sources) && i.sources.length > 0);
  return bestThumb(image ? { thumbnails: image.sources } : undefined, videoId);
}

function parseLockup(l: Json): SearchResult | null {
  const contentId = String(l.contentId ?? '');
  const type = String(l.contentType ?? '');
  const meta = get(l, 'metadata', 'lockupMetadataViewModel');
  const title = text(get(meta, 'title'));
  const rows = (get(meta, 'metadata', 'contentMetadataViewModel', 'metadataRows') ??
    []) as unknown[];
  const parts = rows.flatMap((row) =>
    ((get(row, 'metadataParts') ?? []) as unknown[]).map((p) => text(get(p, 'text'))),
  );
  const badge = findAll(l, 'thumbnailBadgeViewModel').map((b) => String(b.text ?? ''))[0] ?? '';
  const author = parts[0] ?? '';

  if (type.includes('VIDEO')) {
    return {
      kind: 'video',
      id: contentId,
      title,
      author,
      duration: parseDuration(badge),
      thumbnail: lockupThumb(l, contentId),
      url: videoUrl(contentId),
    };
  }
  if (!type.includes('PLAYLIST') && !type.includes('ALBUM')) return null;
  const id = contentId.startsWith('MPRE') ? albumPlaylistId(l) : contentId;
  if (!id) return null;
  const firstVideo = findAll(l, 'watchEndpoint')
    .map((w) => w.videoId)
    .find((x): x is string => typeof x === 'string');
  const count = Number(badge.replace(/\D/g, ''));
  return {
    kind: 'playlist',
    id,
    title,
    author,
    count: count > 0 ? count : undefined,
    thumbnail: lockupThumb(l, firstVideo),
    url: playlistUrl(id),
  };
}

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
    const parsed = parseLockup(l);
    if (parsed) push(parsed);
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
  /** Number of videos the playlist header announces; null when not shown. */
  totalCount: number | null;
  /** Videos on this page that cannot be played (private, deleted): skipped, only counted. */
  unavailable: number;
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

const isVideoItem = (n: unknown): boolean =>
  !!get(n, 'playlistVideoRenderer') ||
  String(get(n, 'lockupViewModel', 'contentType') ?? '').includes('VIDEO');

/** The token of a `continuationCommand`, old (renderer) or new (view model) layout. */
function tokenIn(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const direct = get(node, 'continuationCommand', 'token');
  if (typeof direct === 'string') return direct;
  for (const child of Object.values(node as Json)) {
    const found = tokenIn(child);
    if (found) return found;
  }
  return null;
}

/** First array (anywhere in the tree) that holds playlist videos. */
function findVideoList(node: unknown): unknown[] | null {
  if (Array.isArray(node)) {
    if (node.some(isVideoItem)) return node;
    for (const n of node) {
      const found = findVideoList(n);
      if (found) return found;
    }
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node as Json)) {
      const found = findVideoList(v);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Token for the next songs. It must be the one sitting at the end of the list of videos:
 * the page also carries tokens for other sections (e.g. "more playlists"), and in the
 * newer layout the token is nested under `innertubeCommand`.
 */
function listContinuationToken(json: unknown): string | null {
  const list = findVideoList(json);
  if (list) {
    for (const item of list) {
      if (isVideoItem(item)) continue;
      const token = tokenIn(item);
      if (token) return token;
    }
    return null;
  }
  const legacy = findAll(json, 'nextContinuationData')
    .map((c) => c.continuation)
    .find((x) => typeof x === 'string');
  return typeof legacy === 'string' ? legacy : null;
}

/** "1.234 videos" → 1234. Needs a word after the number so years or names don't match. */
function countFromText(value: string): number | null {
  const m = value
    .trim()
    .match(new RegExp('^([0-9][0-9.,' + String.fromCharCode(160, 8239) + ']*)( [^ ]|$)'));
  const n = m ? Number(m[1]!.replace(/[^0-9]/g, '')) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Video count shown in the playlist header (old header, new page header or sidebar). */
function playlistTotalCount(json: unknown): number | null {
  const header = findAll(json, 'playlistHeaderRenderer')[0];
  const pageHeader = findAll(json, 'pageHeaderViewModel')[0];
  const parts = findAll(pageHeader, 'metadataParts').flatMap((list) =>
    (list as unknown as unknown[]).map((part) => text(get(part, 'text'))),
  );
  const stats = ((header?.stats ?? []) as unknown[]).map(text);
  const candidates = [text(header?.numVideosText), ...parts, ...stats];
  return candidates.map(countFromText).find((n) => n !== null) ?? null;
}

export function parsePlaylistPage(json: unknown): PlaylistPage {
  const entries: PlaylistEntry[] = [];
  const seen = new Set<string>();
  let unavailable = 0;
  for (const v of findAll(json, 'playlistVideoRenderer')) {
    const id = String(v.videoId ?? '');
    // Deleted / private videos stay in playlists but cannot be played.
    if (!id || v.isPlayable === false) {
      unavailable++;
      continue;
    }
    if (seen.has(id)) continue;
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

  return {
    title,
    author,
    entries,
    continuation: listContinuationToken(json),
    totalCount: playlistTotalCount(json),
    unavailable,
  };
}

/**
 * Songs we could not list: the ones skipped page by page plus, once YouTube says there is
 * nothing more, the hidden ones (header count minus what we read).
 */
export function countUnavailable(
  skipped: number,
  readCount: number,
  totalCount: number | null,
  exhausted: boolean,
): number {
  if (!exhausted || totalCount === null) return Math.max(0, skipped);
  return Math.max(0, skipped, totalCount - readCount);
}

/**
 * Did we get the whole playlist? `exhausted` means YouTube itself said there is nothing
 * more (no continuation left): any gap against the header count is then videos that are
 * removed or private, not songs we failed to read.
 */
export function isPlaylistComplete(
  readCount: number,
  totalCount: number | null,
  exhausted: boolean,
): boolean {
  return exhausted || totalCount === null || readCount >= totalCount;
}

/** Keeps the longer of two readings of the same playlist (both in YouTube's order). */
export function pickLongerList<T>(primary: readonly T[], backup: readonly T[]): T[] {
  return [...(backup.length > primary.length ? backup : primary)];
}
