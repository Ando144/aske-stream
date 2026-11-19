import { describe, expect, it } from 'vitest';
import { createSessionToken, safeEqual, verifySessionToken } from '../src/lib/crypto';
import { newId } from '../src/lib/ids';
import { ID_PATTERN } from '../src/lib/http';
import { playlistCoverKey, toFolder, toPlaylist } from '../src/lib/db';
import { isJpeg } from '../src/lib/image';
import { FolderOrderBody, FolderPatchBody } from '../src/routes/folders';
import { PatchPlaylist, PlaylistOrderBody } from '../src/routes/playlists';
import { mapStation } from '../src/lib/radioBrowser';
import { resolveRange } from '../src/routes/media';

const KEY = 'test-access-key-0123456789abcdef';

describe('folders and covers', () => {
  it('maps a folder row', () => {
    expect(
      toFolder({ id: 'f1', name: 'Gym', created_at: 1, updated_at: 2, position: null }),
    ).toEqual({
      id: 'f1',
      name: 'Gym',
      createdAt: 1,
      updatedAt: 2,
      position: null,
      pinnedAt: null,
    });
    expect(
      toFolder({ id: 'f1', name: 'Gym', created_at: 1, updated_at: 2, position: 3 }).position,
    ).toBe(3);
  });

  it('validates the folder order body', () => {
    const valid = ['abcdefgh', 'ABCDEFGH-_12'];
    expect(FolderOrderBody.safeParse({ ids: valid }).success).toBe(true);
    expect(FolderOrderBody.safeParse({ ids: ['short'] }).success).toBe(false);
    expect(FolderOrderBody.safeParse({ ids: ['bad id!!!!'] }).success).toBe(false);
    expect(FolderOrderBody.safeParse({ ids: Array(1001).fill('abcdefgh') }).success).toBe(false);
    expect(FolderOrderBody.safeParse({ ids: Array(1000).fill('abcdefgh') }).success).toBe(true);
  });

  it('maps the new playlist columns, null when absent', () => {
    const row = { id: 'p', name: 'A', description: '', created_at: 1, updated_at: 2 };
    expect(toPlaylist({ ...row, folder_id: null, cover_at: null }, [])).toMatchObject({
      folderId: null,
      coverAt: null,
    });
    expect(toPlaylist({ ...row, folder_id: 'f1', cover_at: 9 }, ['t'])).toMatchObject({
      folderId: 'f1',
      coverAt: 9,
      trackIds: ['t'],
    });
  });

  it('maps position and pinned_at for playlists and folders', () => {
    const row = { id: 'p', name: 'A', description: '', created_at: 1, updated_at: 2 };
    expect(toPlaylist({ ...row, folder_id: null, cover_at: null }, [])).toMatchObject({
      position: null,
      pinnedAt: null,
    });
    expect(
      toPlaylist({ ...row, folder_id: null, cover_at: null, position: 4, pinned_at: 7 }, []),
    ).toMatchObject({ position: 4, pinnedAt: 7 });
    const folder = { id: 'f', name: 'G', created_at: 1, updated_at: 2, position: null };
    expect(toFolder(folder).pinnedAt).toBeNull();
    expect(toFolder({ ...folder, pinned_at: 5 }).pinnedAt).toBe(5);
  });

  it('validates the playlist order and pin bodies', () => {
    expect(PlaylistOrderBody.safeParse({ folderId: null, ids: ['abcdefgh'] }).success).toBe(true);
    expect(PlaylistOrderBody.safeParse({ folderId: 'abcdefgh', ids: [] }).success).toBe(true);
    expect(PlaylistOrderBody.safeParse({ ids: [] }).success).toBe(false);
    expect(PlaylistOrderBody.safeParse({ folderId: null, ids: ['bad id!!!!'] }).success).toBe(
      false,
    );
    expect(
      PlaylistOrderBody.safeParse({ folderId: null, ids: Array(1001).fill('abcdefgh') }).success,
    ).toBe(false);
    expect(PatchPlaylist.safeParse({ pinned: true }).success).toBe(true);
    expect(PatchPlaylist.safeParse({ pinned: 'yes' }).success).toBe(false);
    expect(FolderPatchBody.safeParse({ pinned: false }).success).toBe(true);
    expect(FolderPatchBody.safeParse({}).success).toBe(false);
  });

  it('derives the playlist cover key from the id', () => {
    expect(playlistCoverKey('abc')).toBe('playlists/abc/cover.jpg');
  });

  it('recognises JPEG files by their magic bytes', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0])], 'a.jpg');
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'a.png');
    expect(await isJpeg(jpeg)).toBe(true);
    expect(await isJpeg(png)).toBe(false);
  });

  it('PatchPlaylist accepts folderId null and rejects a malformed id', () => {
    expect(PatchPlaylist.safeParse({ folderId: null }).success).toBe(true);
    expect(PatchPlaylist.safeParse({ folderId: 'abcdefgh12' }).success).toBe(true);
    expect(PatchPlaylist.safeParse({ folderId: 'no/valid id' }).success).toBe(false);
  });
});

describe('session tokens', () => {
  it('accepts a token signed with the same key', async () => {
    const token = await createSessionToken(KEY);
    expect(await verifySessionToken(KEY, token)).toBe(true);
  });

  it('rejects tokens signed with another key (key rotation logs everyone out)', async () => {
    const token = await createSessionToken('another-key-0123456789abcdefgh');
    expect(await verifySessionToken(KEY, token)).toBe(false);
  });

  it('rejects tampered and expired tokens', async () => {
    const token = await createSessionToken(KEY, 1_000);
    const [v, , sig] = token.split('.');
    expect(await verifySessionToken(KEY, `${v}.2000.${sig}`, 5_000)).toBe(false);
    expect(await verifySessionToken(KEY, token, 1_000 + 401 * 24 * 3600 * 1000)).toBe(false);
    expect(await verifySessionToken(KEY, 'garbage')).toBe(false);
  });

  it('compares strings in constant time without leaking length mismatches', async () => {
    expect(await safeEqual('abc', 'abc')).toBe(true);
    expect(await safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('ids', () => {
  it('generates unique ids accepted by the router', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId()));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(ID_PATTERN);
  });
});

describe('resolveRange', () => {
  it('handles offset/length, open-ended and suffix ranges', () => {
    expect(resolveRange({ offset: 100, length: 50 }, 1000)).toEqual({ offset: 100, length: 50 });
    expect(resolveRange({ offset: 900 }, 1000)).toEqual({ offset: 900, length: 100 });
    expect(resolveRange({ suffix: 200 }, 1000)).toEqual({ offset: 800, length: 200 });
    expect(resolveRange({ suffix: 5000 }, 1000)).toEqual({ offset: 0, length: 1000 });
    expect(resolveRange(undefined, 1000)).toBeNull();
  });
});

describe('Radio Browser mapping', () => {
  const base = {
    stationuuid: '96062a7b-0601-11e8-ae97-52543be04c81',
    name: '  Radio Euskadi ',
    url: 'http://example.com/stream',
    url_resolved: 'https://example.com/stream',
    homepage: 'https://www.eitb.eus',
    favicon: 'http://example.com/icon.png',
    countrycode: 'es',
    tags: 'news,basque, talk',
    codec: 'MP3',
    bitrate: 128,
    hls: 0,
    votes: 10,
    clickcount: 5,
    lastcheckok: 1,
  };

  it('normalises a healthy https station', () => {
    expect(mapStation(base)).toMatchObject({
      name: 'Radio Euskadi',
      streamUrl: 'https://example.com/stream',
      favicon: '', // http favicons would be blocked as mixed content
      countryCode: 'ES',
      tags: ['news', 'basque', 'talk'],
    });
  });

  it('keeps http-only stations (Android app) and drops broken ones', () => {
    expect(mapStation({ ...base, url: 'http://a', url_resolved: 'http://b' })?.streamUrl).toBe(
      'http://b',
    );
    expect(mapStation({ ...base, url: 'https://a', url_resolved: 'http://b' })?.streamUrl).toBe(
      'https://a',
    );
    expect(mapStation({ ...base, lastcheckok: 0 })).toBeNull();
  });
});
