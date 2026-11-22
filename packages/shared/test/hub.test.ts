import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/index';
import {
  HUB_LIMITS,
  sanitizeParcelName,
  formatJamCode,
  hubJamLink,
  hubListLink,
  isListId,
  isVideoId,
  normalizeJamCode,
  normalizeNickname,
  normalizeParcelCode,
  hubSendLink,
  parseParcelInput,
  parseHubHash,
  parseHubLink,
  sanitizeHubSong,
} from '../src/hub';

describe('normalizeNickname', () => {
  it('rejects empty and whitespace-only names', () => {
    expect(normalizeNickname('')).toBeNull();
    expect(normalizeNickname('   \t ')).toBeNull();
  });
  it('trims and collapses spaces', () => {
    expect(normalizeNickname('  Ana   María ')).toBe('Ana María');
  });
  it('rejects names longer than 24', () => {
    expect(normalizeNickname('a'.repeat(24))).toBe('a'.repeat(24));
    expect(normalizeNickname('a'.repeat(25))).toBeNull();
  });
  it('keeps emojis and counts them as one character', () => {
    expect(normalizeNickname('DJ 🎧')).toBe('DJ 🎧');
    expect(normalizeNickname('🎧'.repeat(24))).not.toBeNull();
  });
  it('removes control characters', () => {
    expect(normalizeNickname('A\u0000b\u0007c')).toBe('Abc');
    expect(normalizeNickname('\u0000\u0001')).toBeNull();
  });
});

describe('sanitizeHubSong', () => {
  const ok = { videoId: 'dQw4w9WgXcQ', title: 'Song', artist: 'Band', durationMs: 1000 };
  it('accepts a valid song', () => {
    expect(sanitizeHubSong(ok)).toEqual(ok);
  });
  it('rejects a bad videoId or non-objects', () => {
    expect(sanitizeHubSong({ ...ok, videoId: 'short' })).toBeNull();
    expect(sanitizeHubSong(null)).toBeNull();
    expect(sanitizeHubSong('x')).toBeNull();
  });
  it('trims long titles and artists', () => {
    const song = sanitizeHubSong({ ...ok, title: 't'.repeat(500), artist: 'a'.repeat(500) });
    expect(song?.title.length).toBe(300);
    expect(song?.artist.length).toBe(120);
  });
  it('rejects a missing title and tolerates a missing artist or duration', () => {
    expect(sanitizeHubSong({ videoId: ok.videoId, artist: 'x' })).toBeNull();
    expect(sanitizeHubSong({ videoId: ok.videoId, title: 'T' })).toEqual({
      videoId: ok.videoId,
      title: 'T',
      artist: '',
    });
  });
  it('strips control characters and drops invalid durations', () => {
    const song = sanitizeHubSong({ ...ok, title: 'A\u0000B', durationMs: -5 });
    expect(song?.title).toBe('AB');
    expect(song && 'durationMs' in song).toBe(false);
  });
});

describe('ids and codes', () => {
  it('validates video ids and list ids', () => {
    expect(isVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isVideoId('dQw4w9WgXc!')).toBe(false);
    expect(isListId('23456789AB')).toBe(true);
    expect(isListId('23456789A')).toBe(false);
    expect(isListId('0123456789')).toBe(false);
  });
  it('normalizes jam codes', () => {
    expect(normalizeJamCode(' abc-def ')).toBe('ABCDEF');
    expect(normalizeJamCode('ABCDE')).toBeNull();
    expect(normalizeJamCode('ABCDE0')).toBeNull();
    expect(formatJamCode('ABCDEF')).toBe('ABC-DEF');
  });
});

describe('links', () => {
  it('builds links with and without a trailing slash', () => {
    expect(hubListLink('https://hub.example', '23456789AB')).toBe(
      'https://hub.example/#list=23456789AB',
    );
    expect(hubListLink('https://hub.example/', '23456789AB')).toBe(
      'https://hub.example/#list=23456789AB',
    );
    expect(hubJamLink('https://hub.example/', 'ABCDEF')).toBe('https://hub.example/#jam=ABCDEF');
  });
  it('parses list and jam links', () => {
    expect(parseHubLink('https://hub.example/#list=23456789AB')).toEqual({
      kind: 'list',
      id: '23456789AB',
    });
    expect(parseHubLink('https://hub.example/#jam=abc-def')).toEqual({
      kind: 'jam',
      code: 'ABCDEF',
    });
  });
  it('parses a bare jam code', () => {
    expect(parseHubLink('abc-def')).toEqual({ kind: 'jam', code: 'ABCDEF' });
  });
  it('rejects non-local http and unrelated urls', () => {
    expect(parseHubLink('http://hub.example/#jam=ABCDEF')).toBeNull();
    expect(parseHubLink('http://localhost:8787/#jam=ABCDEF')).toEqual({
      kind: 'jam',
      code: 'ABCDEF',
    });
    expect(parseHubLink('https://example.com/#foo=bar')).toBeNull();
    expect(parseHubLink('https://example.com/#list=bad')).toBeNull();
    expect(parseHubLink('hello world')).toBeNull();
  });
  it('parses location hashes', () => {
    expect(parseHubHash('#jam=ABCDEF')).toEqual({ kind: 'jam', code: 'ABCDEF' });
    expect(parseHubHash('#list=23456789AB')).toEqual({ kind: 'list', id: '23456789AB' });
    expect(parseHubHash('')).toBeNull();
  });
});

describe('parcel codes and links', () => {
  it('normalizes a parcel code', () => {
    expect(normalizeParcelCode('abc-def')).toBe('ABCDEF');
    expect(normalizeParcelCode(' ab cd ef ')).toBe('ABCDEF');
    expect(normalizeParcelCode('ABC0EF')).toBeNull();
    expect(normalizeParcelCode('ABCDE')).toBeNull();
  });
  it('builds the send link', () => {
    expect(hubSendLink('https://hub.example/', 'ABCDEF')).toBe('https://hub.example/#send=ABCDEF');
  });
  it('parses a bare code or a link', () => {
    expect(parseParcelInput('abc-def')).toBe('ABCDEF');
    expect(parseParcelInput('ABCDEF')).toBe('ABCDEF');
    expect(parseParcelInput('https://hub.example/#send=abcdef')).toBe('ABCDEF');
    expect(parseParcelInput('http://localhost:8787/#send=ABCDEF')).toBe('ABCDEF');
  });
  it('rejects bad parcel input', () => {
    expect(parseParcelInput('http://evil.example/#send=ABCDEF')).toBeNull();
    expect(parseParcelInput('https://hub.example/#jam=ABCDEF')).toBeNull();
    expect(parseParcelInput('https://hub.example/#send=nope')).toBeNull();
    expect(parseParcelInput('')).toBeNull();
  });
  it('parseHubHash recognizes send', () => {
    expect(parseHubHash('#send=abcdef')).toEqual({ kind: 'send', code: 'ABCDEF' });
    expect(parseHubHash('#send=zz')).toBeNull();
  });
});

describe('parcel limits and names', () => {
  it('parcels hold as many songs as a playlist', () => {
    expect(HUB_LIMITS.parcelMaxSongs).toBe(LIMITS.playlistMaxTracks);
    expect(HUB_LIMITS.parcelBodyMaxBytes).toBe(1024 * 1024);
    expect(HUB_LIMITS.playlistMaxPages).toBe(10);
    expect(HUB_LIMITS.continuationMax).toBe(4096);
  });
  it('sanitizeParcelName strips control chars, trims and cuts to 120', () => {
    expect(sanitizeParcelName('  Mi\u0000 lista\n ')).toBe('Mi lista');
    expect(sanitizeParcelName('a'.repeat(200))).toBe('a'.repeat(LIMITS.nameMax));
  });
  it('sanitizeParcelName returns empty for non strings', () => {
    expect(sanitizeParcelName(42)).toBe('');
    expect(sanitizeParcelName(undefined)).toBe('');
  });
});
