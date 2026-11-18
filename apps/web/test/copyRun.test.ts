import { describe, expect, it, vi } from 'vitest';
import type { Folder, Playlist, Station } from '@aske/shared';
import { ApiError } from '../src/api/client';
import { DriveAuthRequired } from '../src/storage/drive/auth';
import {
  classifyCopyError,
  runCopy,
  type CopyEndpoint,
  type CopyProgress,
  type RunDeps,
} from '../src/storage/copy/run';
import type { Destination, LocalTrack } from '../src/storage/types';

function track(n: number, over: Partial<LocalTrack> = {}): LocalTrack {
  return {
    id: `s${n}`,
    title: `Song ${n}`,
    artist: `Artist ${n}`,
    album: '',
    durationMs: 100_000 + n * 10_000,
    sizeBytes: 1000,
    bitrateKbps: 128,
    hasCover: false,
    kind: 'music',
    source: 'youtube',
    sourceRef: `ref${n}`,
    likedAt: null,
    createdAt: n,
    locations: {},
    mime: 'audio/ogg',
    ...over,
  };
}

function station(n: number, over: Partial<Station> = {}): Station {
  return {
    id: `st${n}`,
    rbUuid: `uuid${n}`,
    name: `Radio ${n}`,
    streamUrl: `https://radio${n}.example/stream`,
    homepage: '',
    favicon: '',
    countryCode: 'ES',
    tags: [],
    codec: '',
    bitrate: 0,
    hls: false,
    isCustom: false,
    likedAt: 1,
    createdAt: 1,
    ...over,
  };
}

interface FakeOpts {
  tracks?: LocalTrack[];
  playlists?: Playlist[];
  folders?: Folder[];
  covers?: Record<string, Blob>;
  coverError?: unknown;
  stations?: Station[];
  writeError?: (t: LocalTrack, call: number) => unknown;
  existed?: (t: LocalTrack) => boolean;
}

function fake(kind: Destination, o: FakeOpts = {}) {
  let calls = 0;
  const written: string[] = [];
  const ep: CopyEndpoint & { written: string[] } = {
    kind,
    written,
    load: async () => ({
      tracks: o.tracks ?? [],
      playlists: o.playlists ?? [],
      folders: o.folders ?? [],
      stations: o.stations ?? [],
    }),
    readAudio: vi.fn(async () => new Blob(['a'])),
    readCover: vi.fn(async () => null),
    writeTrack: vi.fn(async (t: LocalTrack) => {
      calls++;
      const err = o.writeError?.(t, calls);
      if (err) throw err;
      written.push(t.id);
      return { track: { ...t, id: `d-${t.id}` }, existed: o.existed?.(t) ?? false };
    }),
    createPlaylist: vi.fn(async (name: string) => ({
      id: `new-${name}`,
      name,
      description: '',
      trackIds: [],
      createdAt: 1,
      updatedAt: 1,
    })),
    addToPlaylist: vi.fn(async () => undefined),
    createFolder: vi.fn(async (name: string) => ({
      id: `f-${name}`,
      name,
      createdAt: 1,
      updatedAt: 1,
    })),
    movePlaylist: vi.fn(async () => undefined),
    readPlaylistCover: vi.fn(async (pl: Playlist) => o.covers?.[pl.id] ?? null),
    setPlaylistCover: vi.fn(async () => {
      if (o.coverError) throw o.coverError;
    }),
    saveStation: vi.fn(async () => undefined),
    freeBytes: async () => null,
  };
  return ep;
}

function deps(from: CopyEndpoint, to: CopyEndpoint, extra: Partial<RunDeps> = {}) {
  let map: Record<string, string> = {};
  const saved: Record<string, string>[] = [];
  const progress: CopyProgress[] = [];
  const d: RunDeps = {
    from,
    to,
    getMap: async () => map,
    saveMap: async (m) => {
      map = { ...m };
      saved.push({ ...m });
    },
    shouldStop: () => false,
    onProgress: (p) => progress.push({ ...p }),
    ...extra,
  };
  return {
    d,
    saved,
    progress,
    getMap: () => map,
    setMap: (m: Record<string, string>) => (map = m),
  };
}

describe('runCopy', () => {
  it('copies 3 of 5 when 2 were already there', async () => {
    const src = [1, 2, 3, 4, 5].map((n) => track(n));
    const dest = [track(2, { id: 'x2' }), track(4, { id: 'x4' })];
    const { d } = deps(fake('device', { tracks: src }), fake('drive', { tracks: dest }));
    const res = await runCopy(d);
    expect(res.stopped).toBeNull();
    expect(res.progress).toMatchObject({
      total: 5,
      done: 5,
      copied: 3,
      already: 2,
      unsupported: 0,
    });
  });

  it('resumes with the same map without copying twice', async () => {
    const src = [1, 2, 3, 4].map((n) => track(n));
    const to = fake('drive', { tracks: [] });
    let stop = false;
    const first = deps(fake('device', { tracks: src }), to, { shouldStop: () => stop });
    to.writeTrack = vi.fn(async (t: LocalTrack) => {
      to.written.push(t.id);
      if (to.written.length === 2) stop = true;
      return { track: { ...t, id: `d-${t.id}` }, existed: false };
    });
    const r1 = await runCopy(first.d);
    expect(r1.stopped).toBe('cancelled');
    expect(to.written).toEqual(['s1', 's2']);

    stop = false;
    const dest = to.written.map((id) => track(Number(id.slice(1)), { id: `d-${id}` }));
    const to2 = fake('drive', { tracks: dest });
    const second = deps(fake('device', { tracks: src }), to2);
    second.setMap(first.getMap());
    const r2 = await runCopy(second.d);
    expect(to2.written).toEqual(['s3', 's4']);
    expect(r2.stopped).toBeNull();
    expect(r2.progress).toMatchObject({ done: 4, copied: 2, already: 2 });
  });

  it('stops on a full error and keeps the map of the first song', async () => {
    const src = [1, 2, 3].map((n) => track(n));
    const to = fake('cloudflare', {
      writeError: (_t, call) => (call === 2 ? new ApiError(507, 'storage_full', 'full') : null),
    });
    const { d, getMap } = deps(fake('device', { tracks: src }), to);
    const res = await runCopy(d);
    expect(res.stopped).toBe('full');
    expect(getMap()).toEqual({ s1: 'd-s1' });
    expect(res.progress.failed).toEqual([]);
  });

  it('records an other error in failed and carries on', async () => {
    const src = [1, 2, 3].map((n) => track(n));
    const to = fake('drive', {
      writeError: (_t, call) => (call === 2 ? new Error('boom') : null),
    });
    const { d } = deps(fake('device', { tracks: src }), to);
    const res = await runCopy(d);
    expect(res.stopped).toBeNull();
    expect(res.progress.failed).toEqual(['Song 2']);
    expect(res.progress).toMatchObject({ copied: 2, done: 3 });
  });

  it('counts existed as already and builds playlists with destination ids', async () => {
    const src = [1, 2].map((n) => track(n));
    const playlists: Playlist[] = [
      {
        id: 'p1',
        name: 'Mix',
        description: '',
        trackIds: ['s1', 's2'],
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const to = fake('drive', { existed: (t) => t.id === 's1' });
    const { d } = deps(fake('device', { tracks: src, playlists }), to);
    const res = await runCopy(d);
    expect(res.progress).toMatchObject({ copied: 1, already: 1 });
    expect(to.createPlaylist).toHaveBeenCalledWith('Mix', ['d-s1', 'd-s2']);
  });

  it('skips non-Opus songs towards Cloudflare', async () => {
    const src = [
      track(1, { mime: 'audio/mpeg' }),
      track(2),
      track(3, { mime: 'audio/webm;codecs=opus' }),
      track(4, { mime: 'audio/mpeg' }),
      track(5),
    ];
    const from = fake('device', { tracks: src });
    const to = fake('cloudflare');
    const { d } = deps(from, to);
    const res = await runCopy(d);
    expect(res.stopped).toBeNull();
    expect(res.progress).toMatchObject({ unsupported: 2, copied: 3, total: 5, done: 5 });
    expect(res.progress.failed).toEqual([]);
    expect(from.readAudio).toHaveBeenCalledTimes(3);
    expect(to.writeTrack).toHaveBeenCalledTimes(3);
  });

  it('saves only the stations that are missing', async () => {
    const stations = [
      station(1),
      station(2, { rbUuid: null, streamUrl: 'https://same.example/s' }),
      station(3),
    ];
    const destStations = [
      station(9, { rbUuid: 'uuid1' }),
      station(8, { rbUuid: null, streamUrl: 'https://same.example/s' }),
    ];
    const to = fake('drive', { stations: destStations });
    const { d } = deps(fake('device', { stations }), to);
    await runCopy(d);
    expect(to.saveStation).toHaveBeenCalledTimes(1);
    expect(to.saveStation).toHaveBeenCalledWith(stations[2]);
  });

  it('does not do playlists or stations when stopped', async () => {
    const to = fake('drive');
    const from = fake('device', { tracks: [track(1)], stations: [station(1)] });
    const { d } = deps(from, to, { shouldStop: () => true });
    const res = await runCopy(d);
    expect(res.stopped).toBe('cancelled');
    expect(to.saveStation).not.toHaveBeenCalled();
  });
});

describe('runCopy folders and covers', () => {
  const pl = (over: Partial<Playlist>): Playlist => ({
    id: 'p1',
    name: 'Mix',
    description: '',
    trackIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });
  const rock: Folder = { id: 'fr', name: 'Rock', createdAt: 1, updatedAt: 1 };

  it('creates the folder and moves the new playlist into it', async () => {
    const from = fake('device', { playlists: [pl({ folderId: 'fr' })], folders: [rock] });
    const to = fake('drive');
    await runCopy(deps(from, to).d);
    expect(to.createFolder).toHaveBeenCalledWith('Rock');
    expect(to.movePlaylist).toHaveBeenCalledWith('new-Mix', 'f-Rock');
  });

  it('reuses a destination folder with the same name', async () => {
    const from = fake('device', { playlists: [pl({ folderId: 'fr' })], folders: [rock] });
    const to = fake('drive', { folders: [{ ...rock, id: 'dx', name: ' rock ' }] });
    await runCopy(deps(from, to).d);
    expect(to.createFolder).not.toHaveBeenCalled();
    expect(to.movePlaylist).toHaveBeenCalledWith('new-Mix', 'dx');
  });

  it('copies the cover from the source to the destination', async () => {
    const blob = new Blob(['img']);
    const from = fake('device', { playlists: [pl({ coverAt: 5 })], covers: { p1: blob } });
    const to = fake('cloudflare');
    const res = await runCopy(deps(from, to).d);
    expect(to.setPlaylistCover).toHaveBeenCalledWith('new-Mix', blob);
    expect(res.stopped).toBeNull();
  });

  it('copies each cover by playlist id when two source playlists share a name', async () => {
    const blob1 = new Blob(['one']);
    const blob2 = new Blob(['two']);
    const from = fake('device', {
      playlists: [pl({ id: 'p1', coverAt: 5 }), pl({ id: 'p2', coverAt: 6 })],
      covers: { p1: blob1, p2: blob2 },
    });
    const to = fake('cloudflare');
    await runCopy(deps(from, to).d);
    const covers = vi.mocked(to.setPlaylistCover).mock.calls.map((c) => c[1]);
    expect(covers).toEqual([blob1, blob2]);
  });

  it('carries on when the cover cannot be written', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const from = fake('device', {
      playlists: [pl({ coverAt: 5 })],
      covers: { p1: new Blob(['img']) },
      stations: [station(1)],
    });
    const to = fake('cloudflare', { coverError: new ApiError(507, 'storage_full', 'full') });
    const res = await runCopy(deps(from, to).d);
    expect(res.stopped).toBeNull();
    expect(to.saveStation).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not stop when a playlist fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const from = fake('device', { playlists: [pl({})], stations: [station(1)] });
    const to = fake('drive');
    to.createPlaylist = vi.fn(async () => {
      throw new Error('boom');
    });
    const res = await runCopy(deps(from, to).d);
    expect(res.stopped).toBeNull();
    expect(to.saveStation).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('classifyCopyError', () => {
  it('maps known errors', () => {
    expect(classifyCopyError(new DriveAuthRequired())).toBe('auth');
    expect(classifyCopyError(new ApiError(401, 'unauthorized', ''))).toBe('auth');
    expect(classifyCopyError(new ApiError(507, 'storage_full', ''))).toBe('full');
    expect(classifyCopyError(Object.assign(new Error('x'), { code: 'drive_full' }))).toBe('full');
    expect(classifyCopyError(new ApiError(0, 'network_error', ''))).toBe('offline');
    expect(classifyCopyError(new Error('boom'))).toBe('other');
  });
});
