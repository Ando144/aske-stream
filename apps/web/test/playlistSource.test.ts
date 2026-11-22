import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ isNative: false }));
const phone = vi.hoisted(() => ({ listPlaylistOnPhone: vi.fn() }));
const hub = vi.hoisted(() => ({ fetchPlaylistPage: vi.fn() }));

vi.mock('../src/native/platform', () => platform);
vi.mock('../src/native/downloader', () => phone);
vi.mock('../src/hub/client', () => {
  class HubError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return { ...hub, HubError };
});

import { HubError } from '../src/hub/client';
import { listPlaylist, PlaylistLinkError } from '../src/downloads/playlistSource';

const ID = 'PLabcdefghij1234';
const URL = `https://www.youtube.com/playlist?list=${ID}`;
const entry = (n: number) => ({ id: `v${n}`, title: `T${n}`, author: 'A', duration: 1 });
const page = (ids: number[], continuation: string | null) => ({
  title: 'L',
  author: 'A',
  entries: ids.map(entry),
  continuation,
  totalCount: null,
  unavailable: 0,
});

beforeEach(() => {
  vi.useRealTimers();
  platform.isNative = false;
  phone.listPlaylistOnPhone.mockReset();
  hub.fetchPlaylistPage.mockReset();
});

describe('listPlaylist', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc&list=RDabcdefghijk', 'mix'],
    ['https://www.youtube.com/playlist?list=LL', 'personal'],
    ['https://example.com/', 'none'],
  ])('rejects %s as %s', async (url, reason) => {
    await expect(listPlaylist(url, 'es')).rejects.toMatchObject({
      name: 'PlaylistLinkError',
      reason,
    });
  });

  it('reads through the Hub on a computer', async () => {
    hub.fetchPlaylistPage.mockResolvedValueOnce(page([1, 2], 'c1'));
    hub.fetchPlaylistPage.mockResolvedValueOnce(page([3], null));
    const onPartial = vi.fn();
    const listing = await listPlaylist(URL, 'en', onPartial);
    expect(listing.entries).toHaveLength(3);
    expect(hub.fetchPlaylistPage).toHaveBeenNthCalledWith(2, ID, 'c1', 'en');
    expect(onPartial).toHaveBeenCalledTimes(2);
  });

  it('maps playlist_unavailable to private', async () => {
    hub.fetchPlaylistPage.mockRejectedValue(new HubError('playlist_unavailable', 404));
    await expect(listPlaylist(URL, 'es')).rejects.toMatchObject({ reason: 'private' });
  });

  it('propagates other Hub errors', async () => {
    hub.fetchPlaylistPage.mockRejectedValue(new HubError('network', 0));
    const err = await listPlaylist(URL, 'es').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HubError);
    expect(err).not.toBeInstanceOf(PlaylistLinkError);
  });

  it('returns what was read when the timeout hits', async () => {
    vi.useFakeTimers();
    hub.fetchPlaylistPage.mockResolvedValueOnce(page([1], 'c1'));
    hub.fetchPlaylistPage.mockReturnValueOnce(new Promise(() => undefined));
    const result = listPlaylist(URL, 'es');
    await vi.advanceTimersByTimeAsync(60_001);
    expect((await result).entries).toHaveLength(1);
  });

  it('uses the phone when native and fails with private when it finds nothing', async () => {
    platform.isNative = true;
    phone.listPlaylistOnPhone.mockResolvedValue({
      title: '',
      author: '',
      entries: [],
      totalCount: null,
      complete: true,
      unavailable: 0,
    });
    await expect(listPlaylist(URL, 'es')).rejects.toMatchObject({ reason: 'private' });
    expect(hub.fetchPlaylistPage).not.toHaveBeenCalled();
  });

  it('cuts a phone listing to 1000 songs and marks it incomplete', async () => {
    platform.isNative = true;
    phone.listPlaylistOnPhone.mockResolvedValue({
      title: 'L',
      author: 'A',
      entries: Array.from({ length: 1200 }, (_, i) => entry(i)),
      totalCount: 1200,
      complete: true,
      unavailable: 0,
    });
    const listing = await listPlaylist(URL, 'es');
    expect(listing.entries).toHaveLength(1000);
    expect(listing.complete).toBe(false);
  });
});
