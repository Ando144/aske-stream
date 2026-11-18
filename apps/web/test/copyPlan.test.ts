import { describe, expect, it } from 'vitest';
import type { Folder, Playlist, Station } from '@aske/shared';
import {
  buildCopyPlan,
  canStore,
  findInDestination,
  planFolders,
  planPlaylists,
  planStations,
  sameSong,
  spaceCheck,
} from '../src/storage/copy/plan';
import type { LocalTrack } from '../src/storage/types';

let n = 0;
function track(over: Partial<LocalTrack> = {}): LocalTrack {
  n += 1;
  return {
    id: `t${n}`,
    title: `Song ${n}`,
    artist: 'Artist',
    album: '',
    durationMs: 180000,
    sizeBytes: 1000,
    bitrateKbps: null,
    hasCover: false,
    kind: 'music',
    source: null,
    sourceRef: null,
    likedAt: null,
    createdAt: n,
    locations: {},
    mime: 'audio/ogg',
    ...over,
  };
}

function playlist(over: Partial<Playlist>): Playlist {
  return {
    id: 'p',
    name: 'P',
    description: '',
    trackIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function station(over: Partial<Station>): Station {
  return {
    id: 's',
    rbUuid: null,
    name: 'R',
    streamUrl: 'https://a/x',
    homepage: '',
    favicon: '',
    countryCode: '',
    tags: [],
    codec: '',
    bitrate: 0,
    hls: false,
    isCustom: false,
    likedAt: null,
    createdAt: 0,
    ...over,
  };
}

describe('sameSong', () => {
  it('matches by source and sourceRef', () => {
    const a = track({ source: 'youtube', sourceRef: 'abc', title: 'A' });
    const b = track({ source: 'youtube', sourceRef: 'abc', title: 'B' });
    expect(sameSong(a, b)).toBe(true);
    expect(sameSong(a, track({ source: 'file', sourceRef: 'abc' }))).toBe(false);
  });

  it('falls back to normalized metadata within 2 s', () => {
    const a = track({ title: ' Canción  Uno ', artist: 'ÁRTISTA', durationMs: 100000 });
    const ok = track({ title: 'cancion uno', artist: 'artista', durationMs: 102000 });
    const far = track({ title: 'cancion uno', artist: 'artista', durationMs: 103000 });
    expect(sameSong(a, ok)).toBe(true);
    expect(sameSong(a, far)).toBe(false);
  });

  it('uses metadata when only one side lacks sourceRef', () => {
    const a = track({ source: 'youtube', sourceRef: 'abc', title: 'x', artist: 'y' });
    const b = track({ title: 'x', artist: 'y' });
    expect(sameSong(a, b)).toBe(true);
  });
});

describe('findInDestination', () => {
  it('finds by song identity', () => {
    const a = track({ source: 'youtube', sourceRef: 'q' });
    const d = track({ source: 'youtube', sourceRef: 'q' });
    expect(findInDestination(a, [d], {})).toBe(d.id);
  });

  it('trusts the map only if the id still exists in destination', () => {
    const a = track({ title: 'unique-a' });
    const d = track({ title: 'unique-d' });
    expect(findInDestination(a, [d], { [a.id]: d.id })).toBe(d.id);
    expect(findInDestination(a, [d], { [a.id]: 'gone' })).toBeNull();
  });
});

describe('canStore', () => {
  it('limits Cloudflare to ogg and webm', () => {
    expect(canStore('cloudflare', track({ mime: 'audio/mpeg' }))).toBe('format');
    expect(canStore('cloudflare', track({ mime: 'audio/mp4' }))).toBe('format');
    expect(canStore('cloudflare', track({ mime: 'audio/flac' }))).toBe('format');
    expect(canStore('cloudflare', track({ mime: 'audio/webm;codecs=opus' }))).toBe('ok');
    expect(canStore('cloudflare', track({ mime: 'audio/ogg' }))).toBe('ok');
  });

  it('accepts anything on drive and device', () => {
    expect(canStore('drive', track({ mime: 'audio/mpeg' }))).toBe('ok');
    expect(canStore('device', track({ mime: 'audio/flac' }))).toBe('ok');
  });
});

describe('buildCopyPlan', () => {
  it('orders todo oldest first and sums bytes', () => {
    const newer = track({ createdAt: 500, sizeBytes: 10 });
    const older = track({ createdAt: 100, sizeBytes: 5 });
    const plan = buildCopyPlan([newer, older], [], {}, 'drive');
    expect(plan.todo.map((t) => t.id)).toEqual([older.id, newer.id]);
    expect(plan.todoBytes).toBe(15);
  });

  it('puts incompatible formats only in unsupported', () => {
    const mp3 = track({ mime: 'audio/mpeg', sizeBytes: 99 });
    const ogg = track({ sizeBytes: 1 });
    const plan = buildCopyPlan([mp3, ogg], [], {}, 'cloudflare');
    expect(plan.unsupported).toEqual([mp3]);
    expect(plan.todo).toEqual([ogg]);
    expect(plan.todoBytes).toBe(1);
  });

  it('counts songs already in destination even with an incompatible format', () => {
    const mp3 = track({ mime: 'audio/mpeg', source: 'file', sourceRef: 'f' });
    const d = track({ source: 'file', sourceRef: 'f' });
    const plan = buildCopyPlan([mp3], [d], {}, 'cloudflare');
    expect(plan.already).toEqual({ [mp3.id]: d.id });
    expect(plan.unsupported).toEqual([]);
    expect(plan.todo).toEqual([]);
  });

  it('ignores map entries whose destination id was deleted', () => {
    const a = track({ title: 'only-a' });
    const plan = buildCopyPlan([a], [], { [a.id]: 'gone' }, 'drive');
    expect(plan.todo).toEqual([a]);
    expect(plan.already).toEqual({});
  });
});

describe('planPlaylists', () => {
  it('adds only missing songs to a same-name playlist, ignoring case and spaces', () => {
    const src = [playlist({ id: 's1', name: 'Rock', trackIds: ['a', 'b'] })];
    const dest = [playlist({ id: 'd1', name: '  rock ', trackIds: ['B'] })];
    const { actions } = planPlaylists(src, dest, { a: 'A', b: 'B' });
    expect(actions).toEqual([
      {
        kind: 'add',
        playlistId: 'd1',
        name: 'Rock',
        trackIds: ['A'],
        folderName: null,
        copyCover: false,
      },
    ]);
  });

  it('creates new playlists with translated, unique ids', () => {
    const src = [playlist({ name: 'New', trackIds: ['a', 'a', 'b', 'x'] })];
    const { actions } = planPlaylists(src, [], { a: 'A', b: 'B' });
    expect(actions).toEqual([
      { kind: 'create', name: 'New', trackIds: ['A', 'B'], folderName: null, copyCover: false },
    ]);
  });

  it('caps at max and reports overflow', () => {
    const src = [playlist({ name: 'Big', trackIds: ['a', 'b', 'c'] })];
    const map = { a: 'A', b: 'B', c: 'C' };
    const created = planPlaylists(src, [], map, 2);
    expect(created.actions[0]).toMatchObject({ kind: 'create', trackIds: ['A', 'B'] });
    expect(created.overflow).toEqual([{ name: 'Big', count: 1 }]);

    const dest = [playlist({ id: 'd', name: 'Big', trackIds: ['Z'] })];
    const added = planPlaylists(src, dest, map, 2);
    expect(added.actions[0]).toMatchObject({ kind: 'add', trackIds: ['A'] });
    expect(added.overflow).toEqual([{ name: 'Big', count: 2 }]);
  });

  it('skips playlists with no copied songs unless empty in the source', () => {
    const src = [
      playlist({ name: 'None', trackIds: ['x'] }),
      playlist({ name: 'Empty', trackIds: [] }),
    ];
    const { actions } = planPlaylists(src, [], {});
    expect(actions).toEqual([
      { kind: 'create', name: 'Empty', trackIds: [], folderName: null, copyCover: false },
    ]);
  });
});

const folder = (id: string, name: string): Folder => ({ id, name, createdAt: 0, updatedAt: 0 });

describe('planFolders', () => {
  it('does not duplicate folders with the same name in another format', () => {
    const src = [folder('a', 'Rock'), folder('b', ' ROCK  '), folder('c', 'Jazz  Club')];
    expect(planFolders(src, [folder('x', 'rock')])).toEqual(['Jazz  Club']);
    expect(planFolders([folder('a', 'Pop'), folder('b', 'pop')], [])).toEqual(['Pop']);
  });
});

describe('planPlaylists with folders and covers', () => {
  const lists = { src: [folder('fs', 'Rock')], dest: [folder('fd', 'Rock')] };

  it('creates a playlist inside the matching folder with its cover', () => {
    const src = [playlist({ name: 'A', trackIds: ['a'], folderId: 'fs', coverAt: 9 })];
    const { actions } = planPlaylists(src, [], { a: 'A' }, 10, lists);
    expect(actions).toEqual([
      { kind: 'create', name: 'A', trackIds: ['A'], folderName: 'Rock', copyCover: true },
    ]);
  });

  it('keeps the folder and cover of an existing destination playlist', () => {
    const src = [playlist({ name: 'A', folderId: 'fs', coverAt: 9 })];
    const dest = [playlist({ id: 'd', name: 'A', folderId: 'fd', coverAt: 3 })];
    expect(planPlaylists(src, dest, {}, 10, lists).actions).toEqual([]);
  });

  it('adds folder and cover to an existing playlist that lacks them, with no songs', () => {
    const src = [playlist({ name: 'A', folderId: 'fs', coverAt: 9 })];
    const dest = [playlist({ id: 'd', name: 'A' })];
    expect(planPlaylists(src, dest, {}, 10, lists).actions).toEqual([
      {
        kind: 'add',
        playlistId: 'd',
        name: 'A',
        trackIds: [],
        folderName: 'Rock',
        copyCover: true,
      },
    ]);
  });
});

describe('planStations', () => {
  it('matches by rbUuid, else by streamUrl', () => {
    const dest = [
      station({ rbUuid: 'u1', streamUrl: 'https://old' }),
      station({ streamUrl: 'https://same' }),
    ];
    const src = [
      station({ id: '1', rbUuid: 'u1', streamUrl: 'https://new' }),
      station({ id: '2', streamUrl: 'https://same' }),
      station({ id: '3', rbUuid: 'u3', streamUrl: 'https://other' }),
    ];
    expect(planStations(src, dest).map((s) => s.id)).toEqual(['3']);
  });
});

describe('spaceCheck', () => {
  it('fits when free space is unknown', () => {
    expect(spaceCheck(100, null)).toEqual({ fits: true, missingBytes: 0 });
  });

  it('reports the missing bytes', () => {
    expect(spaceCheck(100, 60)).toEqual({ fits: false, missingBytes: 40 });
    expect(spaceCheck(100, 100)).toEqual({ fits: true, missingBytes: 0 });
  });
});
