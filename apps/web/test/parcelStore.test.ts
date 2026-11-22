import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalTrack } from '../src/storage/types';

const hub = vi.hoisted(() => ({
  createParcel: vi.fn(),
  getParcelStatus: vi.fn(),
  claimParcel: vi.fn(),
  cancelParcel: vi.fn(),
}));
const enqueue = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());

vi.mock('../src/hub/client', async () => {
  const actual = await vi.importActual<typeof import('../src/hub/client')>('../src/hub/client');
  return { ...actual, ...hub };
});
vi.mock('../src/stores/downloads', () => ({
  useDownloads: { getState: () => ({ enqueue }) },
}));
vi.mock('../src/stores/ui', () => ({ toast }));

import { HubError } from '../src/hub/client';
import { useLibrary } from '../src/stores/library';
import {
  parcelErrorText,
  phaseWhenMissing,
  receivedMessage,
  songFromResult,
  songsFromTracks,
  useParcel,
} from '../src/stores/parcel';

const song = (n: number) => ({
  videoId: `vid${String(n).padStart(8, '0')}`,
  title: `T${n}`,
  artist: 'A',
});
const created = { code: 'ABCDEF', senderKey: 'key', expiresAt: Date.now() + 60_000, count: 1 };

function track(id: string, over: Partial<LocalTrack> = {}): LocalTrack {
  return {
    id,
    title: `Title ${id}`,
    artist: 'Artist',
    durationMs: 1000,
    source: 'youtube',
    sourceRef: 'dQw4w9WgXcQ',
    ...over,
  } as LocalTrack;
}

beforeEach(() => {
  vi.clearAllMocks();
  useParcel.setState({ basket: [], current: null, busy: false, pendingCode: null });
});

describe('basket', () => {
  it('rejects duplicates and stops at the limit with a toast', () => {
    expect(useParcel.getState().add(song(1))).toBe(true);
    expect(useParcel.getState().add(song(1))).toBe(false);
    useParcel.setState({ basket: Array.from({ length: 1000 }, (_, i) => song(i)) });
    expect(useParcel.getState().add(song(5000))).toBe(false);
    expect(toast).toHaveBeenLastCalledWith(expect.stringContaining('1000'));
  });
});

describe('create', () => {
  it('sends the basket, empties it and waits', async () => {
    hub.createParcel.mockResolvedValue(created);
    useParcel.setState({ basket: [song(1)] });
    expect(await useParcel.getState().create()).toBe(true);
    expect(hub.createParcel).toHaveBeenCalledWith([song(1)]);
    expect(useParcel.getState().basket).toEqual([]);
    expect(useParcel.getState().current?.phase).toBe('waiting');
  });

  it('keeps the basket and shows an error when it fails', async () => {
    hub.createParcel.mockRejectedValue(new HubError('too_many_songs', 413));
    useParcel.setState({ basket: [song(1)] });
    expect(await useParcel.getState().create()).toBe(false);
    expect(useParcel.getState().basket).toHaveLength(1);
    expect(toast).toHaveBeenCalledWith(
      parcelErrorText(new HubError('too_many_songs', 413)),
      'error',
    );
  });
});

describe('poll', () => {
  const wait = (expiresAt: number) =>
    useParcel.setState({ current: { ...created, expiresAt, phase: 'waiting' } });

  it('404 before expiry means received', async () => {
    wait(Date.now() + 60_000);
    hub.getParcelStatus.mockRejectedValue(new HubError('not_found', 404));
    await useParcel.getState().poll();
    expect(useParcel.getState().current?.phase).toBe('received');
  });

  it('404 after expiry and 410 mean expired', async () => {
    wait(Date.now() - 1);
    hub.getParcelStatus.mockRejectedValue(new HubError('not_found', 404));
    await useParcel.getState().poll();
    expect(useParcel.getState().current?.phase).toBe('expired');
    wait(Date.now() + 60_000);
    hub.getParcelStatus.mockRejectedValue(new HubError('expired', 410));
    await useParcel.getState().poll();
    expect(useParcel.getState().current?.phase).toBe('expired');
  });

  it('keeps waiting on network errors', async () => {
    wait(Date.now() + 60_000);
    hub.getParcelStatus.mockRejectedValue(new HubError('network', 0));
    await useParcel.getState().poll();
    expect(useParcel.getState().current?.phase).toBe('waiting');
  });
});

describe('receive', () => {
  it('rejects a bad code without calling the Hub', async () => {
    expect(await useParcel.getState().receive('xx')).toBe('invalid');
    expect(hub.claimParcel).not.toHaveBeenCalled();
  });

  it('queues the songs and tells how many', async () => {
    hub.claimParcel.mockResolvedValue({ songs: [song(1)] });
    enqueue.mockResolvedValue(1);
    expect(await useParcel.getState().receive('abc-def')).toBe('ok');
    expect(enqueue).toHaveBeenCalledWith(
      [{ videoId: song(1).videoId, title: 'T1', author: 'A' }],
      {},
    );
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('1'));
  });

  it('says nothing new when everything was already there', async () => {
    hub.claimParcel.mockResolvedValue({ songs: [song(1)] });
    enqueue.mockResolvedValue(0);
    await useParcel.getState().receive('ABCDEF');
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/already|ya |dagoeneko/i));
  });

  it('asks for a new code when queuing fails after claiming', async () => {
    hub.claimParcel.mockResolvedValue({ songs: [song(1)] });
    enqueue.mockRejectedValue(new Error('disk full'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await useParcel.getState().receive('ABCDEF')).toBe('error');
    spy.mockRestore();
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/new code|código nuevo|kode berri/i),
      'error',
    );
  });

  it('reports a missing parcel', async () => {
    hub.claimParcel.mockRejectedValue(new HubError('not_found', 404));
    expect(await useParcel.getState().receive('ABCDEF')).toBe('error');
    expect(toast).toHaveBeenCalledWith(parcelErrorText(new HubError('not_found', 404)), 'error');
  });
});

describe('helpers', () => {
  it('songFromResult maps id and author', () => {
    expect(songFromResult({ id: 'x', title: 't', author: 'a' })).toEqual({
      videoId: 'x',
      title: 't',
      artist: 'a',
    });
  });

  it('phaseWhenMissing compares with now', () => {
    expect(phaseWhenMissing(10, 5)).toBe('received');
    expect(phaseWhenMissing(10, 10)).toBe('expired');
  });

  it('songsFromTracks keeps YouTube tracks once and counts the rest', () => {
    const out = songsFromTracks([
      track('1'),
      track('2'),
      track('3', { source: 'upload' as never }),
      track('4', { sourceRef: 'bad' }),
      track('5', { sourceRef: 'abcdefghijk' }),
    ]);
    expect(out.skipped).toBe(2);
    expect(out.songs).toEqual([
      { videoId: 'dQw4w9WgXcQ', title: 'Title 1', artist: 'Artist', durationMs: 1000 },
      { videoId: 'abcdefghijk', title: 'Title 5', artist: 'Artist', durationMs: 1000 },
    ]);
  });
});

describe('sendPlaylist', () => {
  const send = (songs: ReturnType<typeof song>[], unavailable = 0) =>
    useParcel.getState().sendPlaylist({ name: 'Mix', songs, unavailable });

  it('refuses an empty selection with a toast', async () => {
    expect(await send([])).toBe(false);
    expect(hub.createParcel).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('refuses more than the parcel limit', async () => {
    const many = Array.from({ length: 1001 }, (_, i) => song(i));
    expect(await send(many)).toBe(false);
    expect(hub.createParcel).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('1000'), 'error');
  });

  it('creates the parcel with the playlist name and unavailable count', async () => {
    hub.createParcel.mockResolvedValue(created);
    expect(await send([song(1)], 3)).toBe(true);
    expect(hub.createParcel).toHaveBeenCalledWith([song(1)], { name: 'Mix', unavailable: 3 });
    expect(useParcel.getState().current?.phase).toBe('waiting');
  });

  it('ignores a second send while busy', async () => {
    useParcel.setState({ busy: true });
    expect(await send([song(1)])).toBe(false);
    expect(hub.createParcel).not.toHaveBeenCalled();
  });
});

describe('receive with a playlist', () => {
  it('queues into a new playlist when the parcel has a name', async () => {
    hub.claimParcel.mockResolvedValue({ songs: [song(1)], name: 'Road', unavailable: 2 });
    enqueue.mockResolvedValue(1);
    await useParcel.getState().receive('ABCDEF');
    expect(enqueue).toHaveBeenCalledWith(expect.any(Array), {
      playlistName: 'Road',
      playlistMode: 'new',
    });
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Road'));
  });

  it('queues with no options when the name is empty', async () => {
    hub.claimParcel.mockResolvedValue({ songs: [song(1)], name: '', unavailable: 0 });
    enqueue.mockResolvedValue(1);
    await useParcel.getState().receive('ABCDEF');
    expect(enqueue).toHaveBeenCalledWith(expect.any(Array), {});
  });
});

describe('receivedMessage', () => {
  const tt = (key: string, p?: Record<string, string | number>) =>
    `${key}|${p?.count ?? ''}|${p?.name ?? ''}`;
  const msg = (q: number, name: string, u: number) => receivedMessage(q, name, u, tt as never);

  it('uses the plain message without a name', () => {
    expect(msg(2, '', 0)).toBe('parcel.gotSongs|2|');
  });
  it('uses the playlist message with a name', () => {
    expect(msg(2, 'Road', 0)).toBe('pick.gotPlaylist|2|Road');
  });
  it('says nothing new when queued is 0', () => {
    expect(msg(0, 'Road', 0)).toBe('parcel.nothingNew||');
  });
  it('appends the unavailable summary', () => {
    expect(msg(2, '', 3)).toBe('parcel.gotSongs|2| pick.unavailableSummary|3|');
  });
});

describe('sendTracks', () => {
  const setTracks = (tracks: LocalTrack[]) =>
    useLibrary.setState({ tracks: Object.fromEntries(tracks.map((x) => [x.id, x])) });

  it('fails with a toast when nothing is sendable', async () => {
    setTracks([track('1', { source: 'upload' as never })]);
    expect(await useParcel.getState().sendTracks(['1', 'unknown'])).toBe(false);
    expect(hub.createParcel).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('refuses more than the parcel limit', async () => {
    const many = Array.from({ length: 1001 }, (_, i) =>
      track(`t${i}`, { sourceRef: song(i).videoId }),
    );
    setTracks(many);
    expect(await useParcel.getState().sendTracks(many.map((x) => x.id))).toBe(false);
    expect(hub.createParcel).not.toHaveBeenCalled();
  });

  it('creates the parcel, leaves the basket alone and mentions skipped ones', async () => {
    hub.createParcel.mockResolvedValue(created);
    setTracks([track('1'), track('2', { source: 'upload' as never })]);
    useParcel.setState({ basket: [song(1)] });
    expect(await useParcel.getState().sendTracks(['1', '2'])).toBe(true);
    expect(useParcel.getState().current?.phase).toBe('waiting');
    expect(useParcel.getState().basket).toHaveLength(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
