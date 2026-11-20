import type {
  HubErrorCode,
  HubSong,
  JamMember,
  JamServerMessage,
  JamSnapshot,
} from '@aske/shared/hub';
import { create } from 'zustand';
import { createJam, getJam, HubError, jamSocketUrl } from '../hub/client';
import { libraryByVideoId, nextReadyItem, songsToPrepare } from '../hub/jamHost';
import { JamSocket, type JamSocketStatus } from '../hub/jamSocket';
import { loadValue, savePref } from '../lib/storage';
import { isNative } from '../native/platform';
import { useDownloads } from './downloads';
import { useLibrary } from './library';
import type { RepeatMode } from '../player/queue';
import { usePlayer } from './player';

export type JamConnection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'ended';
export type JamErrorCode = HubErrorCode | 'network' | 'unavailable';

export interface JamSession {
  code: string;
  role: 'host' | 'guest';
  memberId: string;
  nickname: string;
  hostKey?: string;
  /** Host only: library playlist that receives the downloaded songs. */
  playlistName?: string;
}

type Preparing = Record<string, 'downloading' | 'ready' | 'error'>;

interface JamState {
  session: JamSession | null;
  snapshot: JamSnapshot | null;
  you: JamMember | null;
  connection: JamConnection;
  error: JamErrorCode | null;
  endedReason: 'host' | 'expired' | null;
  preparing: Preparing;
  create(o: { nickname: string; playlistName: string }): Promise<void>;
  join(code: string, nickname: string): Promise<void>;
  resume(): Promise<void>;
  leave(): void;
  add(song: HubSong): void;
  vote(itemId: string): void;
  remove(itemId: string): void;
  skip(): void;
  playItem(itemId: string): void;
  end(): void;
  clearError(): void;
}

const SESSION_KEY = 'jam-session-v1';

const socket = new JamSocket((url) => new WebSocket(url) as never);
let unsubscribers: Array<() => void> = [];
/** Track the Jam asked the player to play; null when no Jam song is playing. */
let playingTrackId: string | null = null;
/** A `start` was sent and the server has not confirmed it yet. */
let startPending = false;
/** The current Jam song has been seen playing (so a stop at 0 means it ended). */
let songHasPlayed = false;
/** Player settings put aside while a Jam song plays, so repeat and the manual queue stay out. */
let stashed: { repeat: RepeatMode; queue: string[] } | null = null;

function stashPlayerSettings() {
  const { repeat, queue } = usePlayer.getState();
  stashed ??= { repeat, queue };
  usePlayer.setState({ repeat: 'off', queue: [] });
}

function restorePlayerSettings() {
  if (!stashed) return;
  const { repeat, queue: saved } = stashed;
  stashed = null;
  // Cleared first: setState notifies watchers synchronously.
  usePlayer.setState({ repeat, queue: [...saved, ...usePlayer.getState().queue] });
}

const errorCodeOf = (err: unknown): JamErrorCode =>
  err instanceof HubError ? err.code : 'internal_error';

const connectionOf: Record<JamSocketStatus, JamConnection | null> = {
  connecting: 'connecting',
  open: 'open',
  reconnecting: 'reconnecting',
  closed: null,
};

export const useJam = create<JamState>((set, get) => {
  function isHost(): boolean {
    return get().session?.role === 'host';
  }

  function stopWatching() {
    unsubscribers.forEach((off) => off());
    unsubscribers = [];
    playingTrackId = null;
    startPending = false;
    restorePlayerSettings();
  }

  function teardown(reason: 'host' | 'expired' | null) {
    stopWatching();
    socket.close();
    savePref(SESSION_KEY, null);
    set({
      session: null,
      snapshot: null,
      you: null,
      preparing: {},
      connection: reason ? 'ended' : 'idle',
      endedReason: reason,
    });
  }

  /** Host: download what is missing and start the next ready song when nothing plays. */
  function hostTick() {
    const { snapshot, session, preparing } = get();
    if (!snapshot || !session || session.role !== 'host') return;
    const ready = libraryByVideoId(Object.values(useLibrary.getState().tracks));
    const inFlight = new Set(Object.keys(preparing).filter((id) => !ready.has(id)));
    const missing = songsToPrepare(snapshot, ready, inFlight);
    if (missing.length > 0) prepare(missing, session.playlistName);
    startNextIfIdle(snapshot, ready);
  }

  function prepare(songs: HubSong[], playlistName?: string) {
    const next = { ...get().preparing };
    for (const s of songs) next[s.videoId] = 'downloading';
    set({ preparing: next });
    const items = songs.map((s) => ({ videoId: s.videoId, title: s.title, author: s.artist }));
    useDownloads
      .getState()
      .enqueue(items, { playlistName })
      .catch(() => {
        const failed = { ...get().preparing };
        for (const s of songs) failed[s.videoId] = 'error';
        set({ preparing: failed });
      });
  }

  function startNextIfIdle(snapshot: JamSnapshot, ready: Map<string, string>) {
    if (snapshot.nowPlaying || startPending || usePlayer.getState().isPlaying) return;
    const next = nextReadyItem(snapshot, ready);
    if (!next) return;
    startItem(next.id, ready.get(next.song.videoId)!);
  }

  function startItem(itemId: string, trackId: string) {
    stashPlayerSettings();
    startPending = true;
    playingTrackId = trackId;
    songHasPlayed = false;
    socket.send({ type: 'start', itemId });
    usePlayer.getState().playTracks([trackId], trackId);
  }

  /** Follows the download jobs of the songs we are preparing. */
  function trackPreparing() {
    const { preparing } = get();
    const jobs = useDownloads.getState().jobs;
    const next = { ...preparing };
    let changed = false;
    for (const [videoId, status] of Object.entries(preparing)) {
      if (status !== 'downloading') continue;
      const job = jobs.find((j) => j.videoId === videoId);
      const result = job && jobResult(job.status);
      if (result) {
        next[videoId] = result;
        changed = true;
      }
    }
    if (changed) set({ preparing: next });
    hostTick();
  }

  /** The Jam song stopped being the current one: tell the server and move on. */
  function watchPlayer() {
    if (!playingTrackId) return;
    const p = usePlayer.getState();
    if (p.mode === 'track' && p.currentId === playingTrackId) {
      if (p.isPlaying) songHasPlayed = true;
      // A one-song queue ends stopped at position 0 on the same track.
      if (!(songHasPlayed && !p.isPlaying && p.position === 0)) return;
    }
    playingTrackId = null;
    songHasPlayed = false;
    startPending = false;
    restorePlayerSettings();
    socket.send({ type: 'finish' });
    hostTick();
  }

  function handleServerMessage(msg: JamServerMessage) {
    if (msg.type === 'state') {
      startPending = false;
      set({ snapshot: msg.jam, you: msg.you });
      if (isHost()) hostTick();
    } else if (msg.type === 'error') {
      set({ error: msg.code });
    } else {
      teardown(msg.reason);
    }
  }

  function connect(session: JamSession) {
    socket.onMessage = handleServerMessage;
    socket.onStatus = (status) => {
      const connection = connectionOf[status];
      if (connection) set({ connection });
      else if (get().connection !== 'ended') set({ connection: 'idle' });
    };
    set({ session, error: null, endedReason: null, connection: 'connecting' });
    savePref(SESSION_KEY, session);
    socket.connect(jamSocketUrl(session.code), {
      type: 'hello',
      memberId: session.memberId,
      nickname: session.nickname,
      hostKey: session.hostKey,
    });
    if (session.role === 'host') {
      unsubscribers = [
        useDownloads.subscribe(trackPreparing),
        useLibrary.subscribe(hostTick),
        usePlayer.subscribe(watchPlayer),
      ];
    }
  }

  return {
    session: null,
    snapshot: null,
    you: null,
    connection: 'idle',
    error: null,
    endedReason: null,
    preparing: {},

    async create({ nickname, playlistName }) {
      if (!isNative) return set({ error: 'unavailable' });
      try {
        const jam = await createJam(nickname);
        connect({
          code: jam.code,
          role: 'host',
          memberId: crypto.randomUUID(),
          nickname,
          hostKey: jam.hostKey,
          playlistName,
        });
      } catch (err) {
        set({ error: errorCodeOf(err) });
      }
    },

    async join(code, nickname) {
      try {
        await getJam(code);
        connect({ code, role: 'guest', memberId: crypto.randomUUID(), nickname });
      } catch (err) {
        set({ error: errorCodeOf(err) });
      }
    },

    async resume() {
      const saved = loadValue<JamSession | null>(SESSION_KEY, null);
      if (!saved || get().session) return;
      try {
        await getJam(saved.code);
        connect(saved);
      } catch (err) {
        // A Jam that no longer exists is forgotten; a network failure keeps it for later.
        if (err instanceof HubError && err.code !== 'network') savePref(SESSION_KEY, null);
        set({ error: errorCodeOf(err) });
      }
    },

    leave() {
      if (!isHost()) teardown(null);
    },

    add: (song) => socket.send({ type: 'add', song }),
    vote: (itemId) => socket.send({ type: 'vote', itemId }),
    remove: (itemId) => socket.send({ type: 'remove', itemId }),

    skip() {
      const { snapshot } = get();
      if (!isHost()) return;
      const ready = libraryByVideoId(Object.values(useLibrary.getState().tracks));
      const next = snapshot && nextReadyItem(snapshot, ready);
      // The server switches nowPlaying on `start`, so no `finish` is needed before it.
      if (next) return startItem(next.id, ready.get(next.song.videoId)!);
      playingTrackId = null;
      startPending = false;
      restorePlayerSettings();
      usePlayer.getState().pause();
      socket.send({ type: 'finish' });
      hostTick();
    },

    playItem(itemId) {
      if (!isHost()) return;
      const item = get().snapshot?.queue.find((i) => i.id === itemId);
      const ready = libraryByVideoId(Object.values(useLibrary.getState().tracks));
      const trackId = item && ready.get(item.song.videoId);
      if (!trackId) return;
      startItem(itemId, trackId);
    },

    end() {
      if (!isHost()) return;
      socket.send({ type: 'end' });
      teardown('host');
    },

    clearError: () => set({ error: null }),
  };
});

function jobResult(status: string): 'ready' | 'error' | null {
  if (status === 'done' || status === 'skipped') return 'ready';
  return status === 'error' || status === 'canceled' ? 'error' : null;
}
