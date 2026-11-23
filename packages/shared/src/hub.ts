import { LIMITS } from './index';
import { PAIRING_CODE_ALPHABET } from './pairing';

export const HUB_LIMITS = {
  listMaxSongs: 1000, // = LIMITS.playlistMaxTracks
  listTtlMs: 90 * 24 * 3600 * 1000,
  jamTtlMs: 12 * 3600 * 1000,
  jamMaxMembers: 30, // simultaneous connections
  jamMaxQueue: 200,
  jamMaxPendingPerMember: 10,
  nicknameMax: 24,
  jamCodeLength: 6,
  listIdLength: 10,
  wsMessageMaxBytes: 8 * 1024,
  listBodyMaxBytes: 512 * 1024,
  parcelMaxSongs: 1000, // = LIMITS.playlistMaxTracks
  parcelTtlMs: 24 * 3600 * 1000,
  parcelCodeLength: 6,
  parcelBodyMaxBytes: 1024 * 1024,
  playlistMaxPages: 10, // 100 songs per page → 1000
  continuationMax: 4096,
} as const;

export interface HubSong {
  videoId: string;
  title: string;
  artist: string;
  durationMs?: number;
}
export interface SharedList {
  id: string;
  name: string;
  songs: HubSong[];
  createdAt: number;
  expiresAt: number;
}
export interface CreatedList {
  id: string;
  deleteKey: string;
  expiresAt: number;
}
export interface CreatedJam {
  code: string;
  hostKey: string;
  expiresAt: number;
}
export interface CreatedParcel {
  code: string;
  senderKey: string;
  expiresAt: number;
  count: number;
}
export interface ParcelStatus {
  code: string;
  count: number;
  expiresAt: number;
}
export interface ParcelRequest {
  songs: HubSong[];
  name?: string;
  unavailable?: number;
}
export interface ClaimedParcel {
  songs: HubSong[];
  /** '' = not a playlist. */
  name: string;
  unavailable: number;
}
export interface JamInfo {
  code: string;
  hostName: string;
  expiresAt: number;
  members: number;
}

export interface JamMember {
  memberId: string;
  nickname: string;
  isHost: boolean;
}
/** What other guests may see about a member: never the private memberId. */
export type JamPublicMember = Omit<JamMember, 'memberId'>;
export interface JamItemView {
  id: string;
  song: HubSong;
  addedBy: string; // nickname
  votes: number;
  votedByMe: boolean;
  mine: boolean;
  addedAt: number;
}
export interface JamSnapshot {
  code: string;
  hostName: string;
  expiresAt: number;
  nowPlaying: JamItemView | null;
  queue: JamItemView[]; // already sorted
  members: JamPublicMember[];
}

export type HubErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'expired'
  | 'rate_limited'
  | 'too_many_songs'
  | 'jam_full'
  | 'queue_full'
  | 'member_limit'
  | 'not_host'
  | 'search_unavailable'
  | 'playlist_unavailable'
  | 'group_not_found'
  | 'group_full'
  | 'not_member'
  | 'not_owner'
  | 'kicked'
  | 'too_many_groups'
  | 'internal_error';

// WebSocket, client to server (JSON)
export type JamClientMessage =
  | { type: 'hello'; memberId: string; nickname: string; hostKey?: string }
  | { type: 'add'; song: HubSong }
  | { type: 'vote'; itemId: string } // toggles the vote
  | { type: 'remove'; itemId: string } // host only (or whoever added it)
  | { type: 'start'; itemId: string } // host only: moves it to nowPlaying
  | { type: 'finish' } // host only: nowPlaying = null
  | { type: 'end' }; // host only: closes the Jam

// WebSocket, server to client
export type JamServerMessage =
  | { type: 'state'; jam: JamSnapshot; you: JamMember }
  | { type: 'error'; code: HubErrorCode }
  | { type: 'ended'; reason: 'host' | 'expired' };

export type HubLink =
  { kind: 'list'; id: string } | { kind: 'jam'; code: string } | { kind: 'send'; code: string };

const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

export function isVideoId(v: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(v);
}

function onlyAlphabet(text: string, length: number): boolean {
  if (text.length !== length) return false;
  for (const char of text) {
    if (!PAIRING_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  return Array.from(raw.replace(CONTROL_CHARS, '').trim()).slice(0, max).join('').trim();
}

/** Trims the fields to LIMITS and strips control characters; null if it is not a usable song. */
export function sanitizeHubSong(raw: unknown): HubSong | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.videoId !== 'string' || !isVideoId(r.videoId)) return null;
  const title = cleanText(r.title, LIMITS.titleMax);
  if (!title) return null;
  const song: HubSong = {
    videoId: r.videoId,
    title,
    artist: cleanText(r.artist, LIMITS.nameMax) ?? '',
  };
  const d = r.durationMs;
  if (typeof d === 'number' && Number.isFinite(d) && d >= 0) song.durationMs = Math.round(d);
  return song;
}

/** Control chars stripped, trimmed, cut to LIMITS.nameMax; '' when not a string. */
export function sanitizeParcelName(raw: unknown): string {
  return cleanText(raw, LIMITS.nameMax) ?? '';
}

/** Trim, collapse spaces, drop control characters; null unless 1..24 characters. */
export function normalizeNickname(raw: string): string | null {
  const text = raw.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
  const length = Array.from(text).length;
  return length >= 1 && length <= HUB_LIMITS.nicknameMax ? text : null;
}

/** Uppercases and strips spaces and dashes; null unless it is 6 symbols of the alphabet. */
export function normalizeJamCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  return onlyAlphabet(code, HUB_LIMITS.jamCodeLength) ? code : null;
}

/** Uppercases and strips spaces and dashes; null unless it is 6 symbols of the alphabet. */
export function normalizeParcelCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  return onlyAlphabet(code, HUB_LIMITS.parcelCodeLength) ? code : null;
}

/** 'ABCDEF' becomes 'ABC-DEF'. */
export function formatJamCode(code: string): string {
  const half = code.length / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

export function isListId(id: string): boolean {
  return onlyAlphabet(id, HUB_LIMITS.listIdLength);
}

const baseOf = (hubUrl: string) => hubUrl.replace(/\/+$/, '');

export function hubListLink(hubUrl: string, id: string): string {
  return `${baseOf(hubUrl)}/#list=${id}`;
}

export function hubJamLink(hubUrl: string, code: string): string {
  return `${baseOf(hubUrl)}/#jam=${code}`;
}

export function hubSendLink(hubUrl: string, code: string): string {
  return `${baseOf(hubUrl)}/#send=${code}`;
}

/** For location.hash: '#list=ID', '#jam=CODE' or '#send=CODE'. */
export function parseHubHash(hash: string): HubLink | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const list = params.get('list');
  if (list !== null) return isListId(list) ? { kind: 'list', id: list } : null;
  const send = params.get('send');
  if (send !== null) {
    const parcel = normalizeParcelCode(send);
    return parcel ? { kind: 'send', code: parcel } : null;
  }
  const jam = params.get('jam');
  const code = jam === null ? null : normalizeJamCode(jam);
  return code ? { kind: 'jam', code } : null;
}

export function isAllowedOrigin(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(url.hostname);
}

/** Bare parcel code ('abc-def') or an https link (http for local hosts) with #send=CODE. */
export function parseParcelInput(text: string): string | null {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return normalizeParcelCode(trimmed);
  }
  if (!isAllowedOrigin(url)) return null;
  const link = parseHubHash(url.hash);
  return link?.kind === 'send' ? link.code : null;
}

/** Accepts an https link (http for local hosts only) or a bare Jam code. */
export function parseHubLink(text: string): HubLink | null {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    const code = normalizeJamCode(trimmed);
    return code ? { kind: 'jam', code } : null;
  }
  return isAllowedOrigin(url) ? parseHubHash(url.hash) : null;
}
