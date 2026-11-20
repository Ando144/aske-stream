import type { JamServerMessage, JamSnapshot } from '@aske/shared/hub';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  socket: {
    connect: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    onMessage: (() => undefined) as (msg: unknown) => void,
    onStatus: (() => undefined) as (status: string) => void,
  },
  prefs: new Map<string, unknown>(),
  createJam: vi.fn(),
  getJam: vi.fn(),
  enqueue: vi.fn(),
  playTracks: vi.fn(),
  pause: vi.fn(),
}));

vi.mock('../src/hub/jamSocket', () => ({
  JamSocket: class {
    constructor() {
      return h.socket;
    }
  },
}));

vi.mock('../src/hub/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/hub/client')>();
  return {
    ...real,
    createJam: h.createJam,
    getJam: h.getJam,
    jamSocketUrl: (code: string) => `wss://hub/${code}`,
  };
});

vi.mock('../src/native/platform', () => ({ isNative: true, isAndroid: true }));

vi.mock('../src/lib/storage', () => ({
  loadValue: (key: string, fallback: unknown) => (h.prefs.has(key) ? h.prefs.get(key) : fallback),
  savePref: (key: string, value: unknown) => {
    h.prefs.set(key, value);
  },
}));

vi.mock('../src/stores/downloads', async () => {
  const { create } = await import('zustand');
  const useDownloads = create(() => ({
    jobs: [] as Array<{ videoId: string; status: string }>,
    enqueue: h.enqueue,
  }));
  return { useDownloads };
});

vi.mock('../src/stores/library', async () => {
  const { create } = await import('zustand');
  const useLibrary = create(() => ({
    tracks: {} as Record<string, { id: string; source?: string; sourceRef?: string }>,
  }));
  return { useLibrary };
});

vi.mock('../src/stores/player', async () => {
  const { create } = await import('zustand');
  const usePlayer = create(() => ({
    isPlaying: false,
    mode: 'track' as string,
    currentId: null as string | null,
    position: 0,
    repeat: 'off' as string,
    queue: [] as string[],
    playTracks: h.playTracks,
    pause: h.pause,
  }));
  return { usePlayer };
});

import { HubError } from '../src/hub/client';
import type { LocalTrack } from '../src/storage/types';
import { useDownloads, type DownloadJob, type JobStatus } from '../src/stores/downloads';
import { useJam } from '../src/stores/jam';
import { useLibrary } from '../src/stores/library';
import { usePlayer } from '../src/stores/player';

const song = (videoId: string) => ({ videoId, title: `t-${videoId}`, artist: `a-${videoId}` });
const snap = (videoIds: string[], nowPlaying: unknown = null): JamSnapshot =>
  ({
    queue: videoIds.map((v) => ({ id: `i-${v}`, song: song(v) })),
    nowPlaying,
  }) as unknown as JamSnapshot;
const deliver = (msg: unknown) => h.socket.onMessage(msg as JamServerMessage);
const state = (videoIds: string[], nowPlaying: unknown = null) =>
  deliver({ type: 'state', jam: snap(videoIds, nowPlaying), you: { id: 'me' } });
const job = (videoId: string, status: JobStatus) => ({ videoId, status }) as unknown as DownloadJob;
const sentTypes = () => h.socket.send.mock.calls.map((c) => (c[0] as { type: string }).type);
const setLibrary = (ids: Record<string, string>) =>
  useLibrary.setState({
    tracks: Object.fromEntries(
      Object.entries(ids).map(
        ([videoId, id]) =>
          [id, { id, source: 'youtube', sourceRef: videoId }] as unknown as [string, LocalTrack],
      ),
    ),
  });

async function startHost() {
  h.createJam.mockResolvedValue({ code: 'ABCD', hostKey: 'hk' });
  h.enqueue.mockResolvedValue(undefined);
  await useJam.getState().create({ nickname: 'Ana', playlistName: 'Jam' });
}

describe('useJam store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.prefs.clear();
    h.enqueue.mockResolvedValue(undefined);
    useLibrary.setState({ tracks: {} });
    useDownloads.setState({ jobs: [] });
    usePlayer.setState({
      isPlaying: false,
      mode: 'track',
      currentId: null,
      position: 0,
      repeat: 'off',
      queue: [],
    });
  });
  afterEach(() => {
    const s = useJam.getState();
    if (s.session?.role === 'host') s.end();
    else s.leave();
    useJam.setState({ error: null, endedReason: null });
  });

  describe('join', () => {
    it('connects as guest and saves the session', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('XYZ', 'Bea');
      const s = useJam.getState();
      expect(s.session).toMatchObject({ code: 'XYZ', role: 'guest', nickname: 'Bea' });
      expect(s.connection).toBe('connecting');
      expect(h.socket.connect).toHaveBeenCalledWith(
        'wss://hub/XYZ',
        expect.objectContaining({ type: 'hello', nickname: 'Bea' }),
      );
      expect(h.prefs.get('jam-session-v1')).toMatchObject({ code: 'XYZ' });
    });

    it('sets the error code and does not connect when the Jam does not exist', async () => {
      h.getJam.mockRejectedValue(new HubError('jam_not_found' as never, 404));
      await useJam.getState().join('NOPE', 'Bea');
      expect(useJam.getState().error).toBe('jam_not_found');
      expect(useJam.getState().session).toBeNull();
      expect(h.socket.connect).not.toHaveBeenCalled();
    });

    it('maps unknown failures to internal_error', async () => {
      h.getJam.mockRejectedValue(new Error('boom'));
      await useJam.getState().join('X', 'B');
      expect(useJam.getState().error).toBe('internal_error');
    });

    it('guest does not download or start anything on state', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('XYZ', 'Bea');
      state(['v1']);
      expect(h.enqueue).not.toHaveBeenCalled();
      expect(h.playTracks).not.toHaveBeenCalled();
      expect(useJam.getState().snapshot?.queue).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('connects as host with the hostKey', async () => {
      await startHost();
      expect(useJam.getState().session).toMatchObject({
        code: 'ABCD',
        role: 'host',
        hostKey: 'hk',
        playlistName: 'Jam',
      });
      expect(h.socket.connect.mock.calls[0]![1]).toMatchObject({ hostKey: 'hk' });
    });

    it('reports hub errors without connecting', async () => {
      h.createJam.mockRejectedValue(new HubError('network', 0));
      await useJam.getState().create({ nickname: 'A', playlistName: 'J' });
      expect(useJam.getState().error).toBe('network');
      expect(h.socket.connect).not.toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('does nothing without a saved session', async () => {
      await useJam.getState().resume();
      expect(h.getJam).not.toHaveBeenCalled();
    });

    it('reconnects to a saved session', async () => {
      h.prefs.set('jam-session-v1', { code: 'S1', role: 'guest', memberId: 'm', nickname: 'n' });
      h.getJam.mockResolvedValue({});
      await useJam.getState().resume();
      expect(useJam.getState().session?.code).toBe('S1');
      expect(h.socket.connect).toHaveBeenCalledTimes(1);
    });

    it('forgets the session when the Jam no longer exists', async () => {
      h.prefs.set('jam-session-v1', { code: 'S1', role: 'guest', memberId: 'm', nickname: 'n' });
      h.getJam.mockRejectedValue(new HubError('jam_not_found' as never, 404));
      await useJam.getState().resume();
      expect(h.prefs.get('jam-session-v1')).toBeNull();
      expect(useJam.getState().error).toBe('jam_not_found');
    });

    it('keeps the session on network failure', async () => {
      const saved = { code: 'S1', role: 'guest', memberId: 'm', nickname: 'n' };
      h.prefs.set('jam-session-v1', saved);
      h.getJam.mockRejectedValue(new HubError('network', 0));
      await useJam.getState().resume();
      expect(h.prefs.get('jam-session-v1')).toEqual(saved);
      expect(useJam.getState().error).toBe('network');
    });

    it('does not reconnect when there is already an active session', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
      h.prefs.set('jam-session-v1', { code: 'B', role: 'guest', memberId: 'm', nickname: 'n' });
      h.socket.connect.mockClear();
      await useJam.getState().resume();
      expect(h.socket.connect).not.toHaveBeenCalled();
    });
  });

  describe('connection status', () => {
    beforeEach(async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
    });

    it('follows open and reconnecting', () => {
      h.socket.onStatus('open');
      expect(useJam.getState().connection).toBe('open');
      h.socket.onStatus('reconnecting');
      expect(useJam.getState().connection).toBe('reconnecting');
    });

    it('keeps the session when replaced and takeOver() connects again', () => {
      h.socket.connect.mockClear();
      h.socket.onStatus('replaced');
      const s = useJam.getState();
      expect(s.connection).toBe('replaced');
      expect(s.session?.code).toBe('A');
      expect(h.prefs.get('jam-session-v1')).toMatchObject({ code: 'A' });
      s.takeOver();
      expect(h.socket.connect).toHaveBeenCalledTimes(1);
      expect(useJam.getState().connection).toBe('connecting');
    });

    it('goes idle when the socket closes without an end message', () => {
      h.socket.onStatus('closed');
      expect(useJam.getState().connection).toBe('idle');
    });

    it('stays ended when the socket closes after the Jam ended', () => {
      deliver({ type: 'ended', reason: 'expired' });
      h.socket.onStatus('closed');
      expect(useJam.getState().connection).toBe('ended');
    });
  });

  describe('end of Jam', () => {
    it('ended message tears everything down and records the reason', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
      state(['v1']);
      deliver({ type: 'ended', reason: 'host' });
      const s = useJam.getState();
      expect(s).toMatchObject({
        session: null,
        snapshot: null,
        connection: 'ended',
        endedReason: 'host',
      });
      expect(h.socket.close).toHaveBeenCalled();
      expect(h.prefs.get('jam-session-v1')).toBeNull();
    });

    it('leave() goes back to idle for guests', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
      useJam.getState().leave();
      expect(useJam.getState()).toMatchObject({ session: null, connection: 'idle' });
    });

    it('leave() is ignored for the host', async () => {
      await startHost();
      useJam.getState().leave();
      expect(useJam.getState().session).not.toBeNull();
    });

    it('end() sends end and closes for the host', async () => {
      await startHost();
      useJam.getState().end();
      expect(sentTypes()).toContain('end');
      expect(useJam.getState()).toMatchObject({ session: null, endedReason: 'host' });
    });

    it('end() does nothing for a guest', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
      useJam.getState().end();
      expect(sentTypes()).not.toContain('end');
      expect(useJam.getState().session).not.toBeNull();
    });

    it('stops reacting to downloads and library after ending', async () => {
      await startHost();
      useJam.getState().end();
      state(['v1']); // snapshot ignored? only host ticks matter
      h.enqueue.mockClear();
      useLibrary.setState({ tracks: {} });
      expect(h.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('server errors', () => {
    it('stores the error code and clearError removes it', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
      deliver({ type: 'error', code: 'rate_limited' });
      expect(useJam.getState().error).toBe('rate_limited');
      useJam.getState().clearError();
      expect(useJam.getState().error).toBeNull();
    });
  });

  describe('member actions', () => {
    it('add, vote and remove are sent to the socket', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
      useJam.getState().add(song('v1'));
      useJam.getState().vote('i1');
      useJam.getState().remove('i1');
      expect(h.socket.send.mock.calls.map((c) => c[0])).toEqual([
        { type: 'add', song: song('v1') },
        { type: 'vote', itemId: 'i1' },
        { type: 'remove', itemId: 'i1' },
      ]);
    });
  });

  describe('host: preparing downloads', () => {
    it('downloads queued songs missing from the library into the playlist', async () => {
      await startHost();
      state(['v1', 'v2']);
      expect(h.enqueue).toHaveBeenCalledTimes(1);
      expect(h.enqueue).toHaveBeenCalledWith(
        [
          { videoId: 'v1', title: 't-v1', author: 'a-v1' },
          { videoId: 'v2', title: 't-v2', author: 'a-v2' },
        ],
        { playlistName: 'Jam' },
      );
      expect(useJam.getState().preparing).toEqual({ v1: 'downloading', v2: 'downloading' });
    });

    it('does not download the same song twice while in flight', async () => {
      await startHost();
      state(['v1']);
      state(['v1']);
      expect(h.enqueue).toHaveBeenCalledTimes(1);
    });

    it('does not download songs already in the library', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      state(['v1']);
      expect(h.enqueue).not.toHaveBeenCalled();
    });

    it('marks songs as error when enqueue rejects', async () => {
      await startHost();
      h.enqueue.mockRejectedValue(new Error('x'));
      state(['v1']);
      await vi.waitFor(() => expect(useJam.getState().preparing.v1).toBe('error'));
    });

    it('follows job results: done becomes ready, error stays error', async () => {
      await startHost();
      state(['v1', 'v2']);
      useDownloads.setState({
        jobs: [job('v1', 'done'), job('v2', 'error')],
      });
      expect(useJam.getState().preparing).toEqual({ v1: 'ready', v2: 'error' });
    });

    it('keeps downloading while the job is still running', async () => {
      await startHost();
      state(['v1']);
      useDownloads.setState({ jobs: [job('v1', 'downloading')] });
      expect(useJam.getState().preparing.v1).toBe('downloading');
    });
  });

  describe('host: playing', () => {
    it('starts the first ready song when idle and tells the server', async () => {
      await startHost();
      setLibrary({ v2: 't2' });
      state(['v1', 'v2']);
      expect(h.socket.send).toHaveBeenCalledWith({ type: 'start', itemId: 'i-v2' });
      expect(h.playTracks).toHaveBeenCalledWith(['t2'], 't2');
    });

    it('does not start a second song while the start is unconfirmed', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      state(['v1']);
      useLibrary.setState({ tracks: { ...useLibrary.getState().tracks } });
      expect(sentTypes().filter((t) => t === 'start')).toHaveLength(1);
    });

    it('does not start when the Jam already has a song playing', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      state(['v1'], { itemId: 'i-v1' });
      expect(h.playTracks).not.toHaveBeenCalled();
    });

    it('does not start when the player is already playing', async () => {
      await startHost();
      usePlayer.setState({ isPlaying: true });
      setLibrary({ v1: 't1' });
      state(['v1']);
      expect(sentTypes()).not.toContain('start');
    });

    it('starts the song once the download lands in the library', async () => {
      await startHost();
      state(['v1']);
      expect(sentTypes()).not.toContain('start');
      setLibrary({ v1: 't1' });
      expect(h.playTracks).toHaveBeenCalledWith(['t1'], 't1');
    });

    it('sends finish when the player moves away from the Jam song', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      state(['v1']);
      usePlayer.setState({ currentId: 't1', isPlaying: true });
      h.socket.send.mockClear();
      usePlayer.setState({ currentId: 'other' });
      expect(sentTypes()).toEqual(['finish']);
    });

    it('does not send finish while the Jam song keeps playing', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      state(['v1']);
      usePlayer.setState({ currentId: 't1', isPlaying: true });
      h.socket.send.mockClear();
      usePlayer.setState({ isPlaying: false, position: 42 }); // paused mid-song
      expect(sentTypes()).not.toContain('finish');
    });

    it('sends finish when the single-song queue ends stopped at position 0', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      state(['v1']);
      usePlayer.setState({ currentId: 't1', isPlaying: true });
      h.socket.send.mockClear();
      usePlayer.setState({ isPlaying: false, position: 0 });
      // The mock server never clears nowPlaying, so the host may also try the next start.
      expect(sentTypes()[0]).toBe('finish');
    });

    it('does not send finish for a stop at 0 before the song ever played', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      state(['v1']);
      h.socket.send.mockClear();
      usePlayer.setState({ currentId: 't1', isPlaying: false, position: 0 });
      expect(sentTypes()).not.toContain('finish');
    });

    it('skip() sends finish for the host and ignores guests', async () => {
      await startHost();
      useJam.getState().skip();
      expect(sentTypes()).toContain('finish');
      useJam.getState().end();
      h.socket.send.mockClear();
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
      useJam.getState().skip();
      expect(h.socket.send).not.toHaveBeenCalled();
    });

    it('skip() starts the next ready song without finishing first', async () => {
      await startHost();
      setLibrary({ v1: 't1', v2: 't2' });
      state(['v1', 'v2']);
      usePlayer.setState({ currentId: 't1', isPlaying: true });
      state(['v2'], { itemId: 'i-v1' });
      h.socket.send.mockClear();
      h.playTracks.mockClear();
      useJam.getState().skip();
      expect(h.socket.send).toHaveBeenCalledWith({ type: 'start', itemId: 'i-v2' });
      expect(sentTypes()).not.toContain('finish');
      expect(h.playTracks).toHaveBeenCalledWith(['t2'], 't2');
    });

    it('skip() with nothing ready pauses the player and finishes', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      state(['v1']);
      usePlayer.setState({ currentId: 't1', isPlaying: true });
      state([], { itemId: 'i-v1' });
      h.socket.send.mockClear();
      useJam.getState().skip();
      expect(h.pause).toHaveBeenCalled();
      expect(sentTypes()).toEqual(['finish']);
    });

    it('turns repeat off and sets the manual queue aside during a Jam song', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      usePlayer.setState({ repeat: 'one', queue: ['q1'] });
      state(['v1']);
      expect(usePlayer.getState()).toMatchObject({ repeat: 'off', queue: [] });
      usePlayer.setState({ currentId: 't1', isPlaying: true });
      usePlayer.setState({ currentId: 'other' });
      expect(usePlayer.getState()).toMatchObject({ repeat: 'one', queue: ['q1'] });
    });

    it('playItem() plays a ready queued item and notifies the server', async () => {
      await startHost();
      setLibrary({ v1: 't1' });
      usePlayer.setState({ isPlaying: true }); // avoid auto start
      state(['v1']);
      useJam.getState().playItem('i-v1');
      expect(h.socket.send).toHaveBeenCalledWith({ type: 'start', itemId: 'i-v1' });
      expect(h.playTracks).toHaveBeenCalledWith(['t1'], 't1');
    });

    it('playItem() ignores unknown items and songs not downloaded yet', async () => {
      await startHost();
      state(['v1']);
      useJam.getState().playItem('nope');
      useJam.getState().playItem('i-v1');
      expect(h.playTracks).not.toHaveBeenCalled();
      expect(sentTypes()).not.toContain('start');
    });

    it('playItem() as guest does not touch the player', async () => {
      h.getJam.mockResolvedValue({});
      await useJam.getState().join('A', 'n');
      setLibrary({ v1: 't1' });
      state(['v1']);
      useJam.getState().playItem('i-v1');
      expect(h.playTracks).not.toHaveBeenCalled();
    });
  });
});
