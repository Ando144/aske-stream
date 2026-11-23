import { LIMITS } from './index';
import { isAllowedOrigin } from './hub';
import { PAIRING_CODE_ALPHABET } from './pairing';

export const GROUP_LIMITS = {
  maxMembers: 20,
  maxGroupsPerDevice: 10,
  nameMax: 40,
  groupIdLength: 10, // PAIRING_CODE_ALPHABET
  inviteCodeLength: 8, // same alphabet
  memberIdLength: 10,
  shareIdLength: 10,
  topSize: 10,
  maxShares: 50, // the 50 newest are kept
  inactiveTtlMs: 180 * 24 * 3600 * 1000,
  deviceKeyHexLength: 64,
  statsKeepMonths: 12, // current UTC month + 11 before it
  statsMaxMonthsPerUpload: 12,
  statsBodyMaxBytes: 64 * 1024,
  syncEveryMs: 6 * 3600 * 1000,
} as const;

export interface GroupMember {
  memberId: string;
  alias: string;
  isOwner: boolean;
  joinedAt: number;
}
export interface GroupSummary {
  id: string;
  name: string;
  members: number;
  isOwner: boolean;
}
export interface GroupDetail {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  /** Your memberId in this group. */
  you: string;
  /** Ordered by joinedAt ascending. */
  members: GroupMember[];
}
export interface MonthTopTrack {
  title: string;
  artist: string;
  plays: number;
  minutes: number;
}
export interface MonthTopArtist {
  artist: string;
  plays: number;
  minutes: number;
}
export interface MonthStats {
  /** 'YYYY-MM' (local month of the phone). */
  month: string;
  minutes: number;
  plays: number;
  topTracks: MonthTopTrack[];
  topArtists: MonthTopArtist[];
}
export interface MemberMonthStats extends MonthStats {
  memberId: string;
  alias: string;
}
export interface RankedTrack {
  title: string;
  artist: string;
  plays: number;
  listeners: number;
}
export interface RankedArtist {
  artist: string;
  plays: number;
  listeners: number;
}
export interface GroupStats {
  month: string;
  /** Only members who uploaded that month, most minutes first. */
  members: MemberMonthStats[];
  ranking: { tracks: RankedTrack[]; artists: RankedArtist[] };
}
export type GroupShareKind = 'list' | 'jam';
export interface GroupShare {
  id: string;
  kind: GroupShareKind;
  /** List id (10 symbols) or Jam code (6). */
  ref: string;
  title: string;
  memberId: string;
  alias: string;
  createdAt: number;
  expiresAt: number;
}
export interface StatsUpload {
  months: MonthStats[];
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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

export function isMonthKey(s: string): boolean {
  return MONTH_RE.test(s);
}

export function utcMonthKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 7);
}

export function shiftMonthKey(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  const year = Math.floor(total / 12);
  const monthNumber = (total % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}`;
}

export function oldestKeptMonth(now: number): string {
  return shiftMonthKey(utcMonthKey(now), -(GROUP_LIMITS.statsKeepMonths - 1));
}

/** The next UTC month is allowed as margin for phones ahead of UTC. */
export function isAcceptableMonth(month: string, now: number): boolean {
  if (!isMonthKey(month)) return false;
  return month >= oldestKeptMonth(now) && month <= shiftMonthKey(utcMonthKey(now), 1);
}

function count(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : null;
}

function sanitizeTop(raw: unknown, withTitle: boolean): Array<Record<string, unknown>> | null {
  if (!Array.isArray(raw)) return null;
  const out: Array<Record<string, unknown>> = [];
  for (const item of raw.slice(0, GROUP_LIMITS.topSize)) {
    if (typeof item !== 'object' || item === null) return null;
    const r = item as Record<string, unknown>;
    const artist = cleanText(r.artist, LIMITS.nameMax);
    const plays = count(r.plays);
    const minutes = count(r.minutes);
    if (artist === null || plays === null || minutes === null) return null;
    if (!withTitle) {
      out.push({ artist, plays, minutes });
      continue;
    }
    const title = cleanText(r.title, LIMITS.titleMax);
    if (!title) return null;
    out.push({ title, artist, plays, minutes });
  }
  return out;
}

/** Trims texts to LIMITS, keeps whole numbers >= 0 and at most topSize entries; null if unusable. */
export function sanitizeMonthStats(raw: unknown): MonthStats | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.month !== 'string' || !isMonthKey(r.month)) return null;
  const minutes = count(r.minutes);
  const plays = count(r.plays);
  const topTracks = sanitizeTop(r.topTracks, true);
  const topArtists = sanitizeTop(r.topArtists, false);
  if (minutes === null || plays === null || !topTracks || !topArtists) return null;
  return {
    month: r.month,
    minutes,
    plays,
    topTracks: topTracks as unknown as MonthTopTrack[],
    topArtists: topArtists as unknown as MonthTopArtist[],
  };
}

export function sanitizeGroupName(raw: unknown): string | null {
  const name = cleanText(raw, GROUP_LIMITS.nameMax);
  return name ? name : null;
}

/** Uppercases and strips spaces and dashes; null unless it is 8 symbols of the alphabet. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  return onlyAlphabet(code, GROUP_LIMITS.inviteCodeLength) ? code : null;
}

export function isGroupId(id: string): boolean {
  return onlyAlphabet(id, GROUP_LIMITS.groupIdLength);
}

export function hubGroupLink(hubUrl: string, code: string): string {
  return `${hubUrl.replace(/\/+$/, '')}/#group=${code}`;
}

/** Bare invite code or an https link (http for local hosts) with #group=CODE. */
export function parseGroupInput(text: string): string | null {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return normalizeInviteCode(trimmed);
  }
  if (!isAllowedOrigin(url)) return null;
  const code = new URLSearchParams(url.hash.replace(/^#/, '')).get('group');
  return code === null ? null : normalizeInviteCode(code);
}
