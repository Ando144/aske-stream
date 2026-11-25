import { create } from 'zustand';
import { t } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { nextIndex, orderForDataSaver, previousIndex, withoutTracks } from '../player/queue';
import {
  cycleFor,
  cycleKey,
  recordPlayed,
  rememberCycle,
  shuffledCycleOrder,
} from '../player/shuffleCycle';
import { createAudioControls, createListActions } from '../player/actions';
import { attachAudioEvents } from '../player/audioEvents';
import { linkPlayerToLibrary } from '../player/libraryLinks';
import { createMediaSession } from '../player/mediaSession';
import { startRadio as startRadioEngine, stationAt, type RadioDeps } from '../player/radioEngine';
import { audio, resetSource, rt, userPause } from '../player/runtime';
import { attachStallRecovery } from '../player/stallRecovery';
import type { PlayContext, PlayerState, RadioItem, SavedPlayer } from '../player/types';
import { resolveAudio } from '../storage/media';
import { useLibrary } from './library';
import { useOffline } from './offline';
import { resumePosition, usePodcasts } from './podcasts';
import { usePrefs } from './prefs';
import { toast } from './ui';
import { mayRotateOfflineNow } from '../lib/power';
import { createRunThrottle } from '../offline/runThrottle';

export type { PlayContext, RadioItem };

/**
 * Playback engine + state.
 *
 * One <audio> element lives for the whole app session. Using a plain media
 * element (no Web Audio graph) is what keeps audio alive in the background on
 * mobile and gives lock-screen controls through the Media Session API.
 *
 * Two lists, like a real music app:
 *  - `queue`   — songs the user explicitly queued ("Add to queue", swipe).
 *                They always play first and are consumed as they play.
 *  - `context` — the list you pressed play on (library, playlist…), possibly
 *                shuffled; `index` is the position of the current/last song.
 */

const RUN_MIN_GAP_MS = 10 * 60 * 1000;
/** Offline rotation after loading a song, at most every 10 min; in the background only if cheap. */
const scheduleRunThrottled = createRunThrottle({
  minGapMs: RUN_MIN_GAP_MS,
  mayRun: () => mayRotateOfflineNow(usePlayer.getState().isPlaying),
  run: () => useOffline.getState().scheduleRun(5000),
});

const saved = loadValue<SavedPlayer | null>('player-v2', null);
const savedVolume = loadValue<{ volume: number; muted: boolean }>('volume', {
  volume: 1,
  muted: false,
});
audio.volume = savedVolume.volume;
audio.muted = savedVolume.muted;

const isPodcast = (id: string | null) =>
  !!id && useLibrary.getState().tracks[id]?.kind === 'podcast';

const availableOffline = (id: string) =>
  !!useLibrary.getState().tracks[id]?.locations.device || !!useOffline.getState().entries[id];

/** Engine internals the media-element listeners below need to call. */
const engine = {
  advance: (_auto: boolean): void => undefined,
  persist: (): void => undefined,
  forgetTracks: (_removed: Set<string>): void => undefined,
  reloadCurrent: (): Promise<void> => Promise.resolve(),
  retryRadio: (): boolean => false,
};

export const usePlayer = create<PlayerState>((set, get) => {
  const radioDeps: RadioDeps = { set, updateMediaSession: () => updateMediaSession() };

  function persist() {
    const s = get();
    if (s.mode === 'radio') return;
    savePref('player-v2', {
      currentId: s.currentId,
      fromQueue: s.fromQueue,
      queue: s.queue,
      context: s.context,
      original: s.original,
      index: s.index,
      shuffle: s.contextShuffled,
      repeat: s.repeat,
      position: audio.currentTime || s.position,
      contextInfo: s.contextInfo,
      shuffleCycles: s.shuffleCycles,
    } satisfies SavedPlayer);
  }

  /** Remembers that `id` was heard in the shuffle cycle of the current list. */
  function recordShufflePlay(id: string) {
    const s = get();
    const key = cycleKey(s.contextInfo);
    const now = Date.now();
    const cycle = recordPlayed(cycleFor(s.shuffleCycles, key, now), id, s.original);
    set({ shuffleCycles: rememberCycle(s.shuffleCycles, cycle, now) });
  }

  /** Shuffled order that puts songs not yet heard in this list first. */
  function cycleOrder(ids: string[], firstId: string | null, ctx: PlayContext | null) {
    const cycle = cycleFor(get().shuffleCycles, cycleKey(ctx), Date.now());
    return shuffledCycleOrder(ids, firstId, new Set(cycle.played), get().currentId);
  }

  /** Device file → offline cache → cloud stream (see storage/media.ts). */
  async function sourceFor(trackId: string): Promise<string | null> {
    const track = useLibrary.getState().tracks[trackId];
    if (!track) return null;
    return resolveAudio(track, !!useOffline.getState().entries[trackId]);
  }

  /** Loads `currentId`; if it cannot play offline, moves on to the next playable song. */
  async function loadCurrent(autoplay: boolean, startAt = 0): Promise<void> {
    const seq = ++rt.loadSeq;
    const pauseSeq = rt.userPauseSeq;
    let src: string | null = null;
    for (let tries = 0; tries < get().context.length + get().queue.length + 1; tries++) {
      const id = get().currentId;
      if (id) src = await sourceFor(id);
      if (seq !== rt.loadSeq) {
        if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
        return;
      }
      if (src) break;
      if (!step(false)) break;
      startAt = 0;
    }
    if (!src) {
      toast(t('toast.notOffline'), 'error');
      audio.pause();
      set({ isPlaying: false });
      return;
    }
    resetSource();
    if (src.startsWith('blob:')) rt.objectUrl = src;
    rt.listenedMarked = false;
    const id = get().currentId!;
    if (get().contextShuffled && !get().fromQueue) recordShufflePlay(id);
    const podcast = isPodcast(id);
    if (podcast && startAt === 0) startAt = resumePosition(id);
    rt.pendingSeek = startAt > 0 ? startAt : null;
    rt.reloading = false;
    const rate = podcast ? usePodcasts.getState().rate : 1;
    set({ mode: 'track', station: null, position: startAt, duration: 0, rate });
    audio.src = src;
    audio.playbackRate = rate;
    audio.defaultPlaybackRate = rate;
    updateMediaSession();
    persist();
    scheduleRunThrottled();
    if (!autoplay) return;
    // The user paused while the source was being resolved: leave the song loaded but silent.
    if (rt.userPauseSeq !== pauseSeq) set({ isPlaying: false });
    else audio.play().catch(() => set({ isPlaying: false }));
  }

  /** Reloads the current song at the same second (stall recovery); never touches the cursor. */
  async function reloadCurrent(): Promise<void> {
    const { currentId: id, mode } = get();
    if (mode !== 'track' || !id) return;
    const at = rt.pendingSeek ?? audio.currentTime;
    const seq = ++rt.loadSeq;
    const pauseSeq = rt.userPauseSeq;
    const wasPlaying = get().isPlaying || !audio.paused;
    const src = await sourceFor(id);
    if (seq !== rt.loadSeq || get().currentId !== id) {
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
      return;
    }
    if (!src) return;
    resetSource();
    if (src.startsWith('blob:')) rt.objectUrl = src;
    rt.pendingSeek = at > 0 ? at : null;
    rt.reloading = true;
    audio.src = src;
    audio.playbackRate = audio.defaultPlaybackRate = get().rate;
    if (wasPlaying && rt.userPauseSeq === pauseSeq) audio.play().catch(() => undefined);
  }

  /**
   * Moves the cursor to the next song without loading it.
   * Returns false at the end of everything (repeat off).
   */
  function step(userAction: boolean): boolean {
    const s = get();
    if (s.queue.length) {
      set({ currentId: s.queue[0]!, queue: s.queue.slice(1), fromQueue: true });
      return true;
    }
    const mode = s.repeat === 'off' && userAction ? 'off' : s.repeat;
    const ni = nextIndex(s.context.length, s.index, mode);
    if (ni === null) return false;
    if (ni === 0 && s.contextShuffled && s.context.length > 1) {
      const last = s.context[s.index] ?? null;
      const cycle = cycleFor(s.shuffleCycles, cycleKey(s.contextInfo), Date.now());
      // An empty cycle means the round just ended: treat all as heard so the last song doesn't open the next round.
      const played = cycle.played.length ? new Set(cycle.played) : new Set(s.original);
      const context = shuffledCycleOrder(s.original, null, played, last);
      set({ context, index: 0, currentId: context[0]!, fromQueue: false });
      return true;
    }
    set({ index: ni, currentId: s.context[ni]!, fromQueue: false });
    return true;
  }

  const startRadio = (item: RadioItem, forceUrl?: string) =>
    startRadioEngine(item, radioDeps, forceUrl);

  function advance(auto: boolean) {
    const s = get();
    if (s.mode === 'radio') {
      const next = stationAt(s.stationList, s.station?.key, 1);
      if (next) void startRadio(next);
      return;
    }
    if (s.mode !== 'track') return;
    if (!step(!auto)) {
      if (auto) {
        audio.pause();
        audio.currentTime = 0;
        set({ isPlaying: false, position: 0 });
      }
      return;
    }
    void loadCurrent(true);
  }

  /** Removes deleted songs from playback; if the current one went, moves on or stops. */
  function forgetTracks(removed: Set<string>) {
    const s = get();
    const { currentRemoved, ...lists } = withoutTracks(s, removed);
    set(lists);
    if (currentRemoved && s.mode === 'track') {
      const wasPlaying = s.isPlaying;
      if (step(false)) {
        void loadCurrent(wasPlaying);
      } else {
        rt.loadSeq++;
        audio.pause();
        resetSource();
        set({ mode: 'idle', currentId: null, isPlaying: false });
      }
    }
    persist();
  }

  engine.advance = advance;
  engine.persist = persist;
  engine.forgetTracks = forgetTracks;
  engine.reloadCurrent = reloadCurrent;
  engine.retryRadio = () => {
    const st = get().station;
    if (!st || !rt.triedHttpsUpgrade) return false;
    void startRadio(st, st.streamUrl);
    return true;
  };

  return {
    mode: saved?.currentId ? 'track' : 'idle',
    currentId: saved?.currentId ?? null,
    fromQueue: saved?.fromQueue ?? false,
    queue: saved?.queue ?? [],
    context: saved?.context ?? [],
    original: saved?.original ?? saved?.context ?? [],
    index: saved?.index ?? 0,
    contextInfo: saved?.contextInfo ?? null,
    shuffleCycles: saved?.shuffleCycles ?? {},
    shuffle: loadValue<boolean>('shuffle', saved?.shuffle ?? false),
    contextShuffled: saved?.shuffle ?? false,
    repeat: saved?.repeat ?? 'off',
    isPlaying: false,
    buffering: false,
    position: saved?.position ?? 0,
    duration: 0,
    volume: savedVolume.volume,
    muted: savedVolume.muted,
    rate: 1,
    station: null,
    stationList: [],

    playTracks(ids, startId = null, opts = {}) {
      if (!ids.length) return;
      const shuffle = opts.shuffle ?? (get().shuffle && !opts.context?.fixedOrder);
      let context: string[];
      if (!startId && usePrefs.getState().dataSaver && navigator.onLine) {
        context = orderForDataSaver(ids, availableOffline, shuffle);
      } else {
        context = shuffle ? cycleOrder(ids, startId, opts.context ?? null) : [...ids];
      }
      const index = startId ? Math.max(0, context.indexOf(startId)) : 0;
      rt.consecutiveErrors = 0;
      set({
        context,
        original: [...ids],
        index,
        currentId: context[index]!,
        fromQueue: false,
        contextShuffled: shuffle,
        contextInfo: opts.context ?? null,
        mode: 'track',
      });
      void loadCurrent(true);
    },

    playAt(contextIndex) {
      const id = get().context[contextIndex];
      if (!id) return;
      set({ index: contextIndex, currentId: id, fromQueue: false });
      void loadCurrent(true);
    },

    playFromQueue(queueIndex) {
      const queue = [...get().queue];
      const [id] = queue.splice(queueIndex, 1);
      if (!id) return;
      set({ queue, currentId: id, fromQueue: true, mode: 'track' });
      void loadCurrent(true);
    },

    togglePlay() {
      const s = get();
      if (s.mode === 'idle') return;
      if (!audio.src && s.mode === 'track') {
        void loadCurrent(true, s.position);
        return;
      }
      if (!audio.paused) {
        userPause();
      } else if (s.mode === 'radio' && s.station) {
        void startRadio(s.station);
      } else {
        audio.play().catch(() => set({ isPlaying: false }));
      }
    },

    pause: userPause,
    next: () => advance(false),

    previous() {
      const s = get();
      if (s.mode === 'radio') {
        const prev = stationAt(s.stationList, s.station?.key, -1);
        if (prev) void startRadio(prev);
        return;
      }
      if (audio.currentTime > 3 || !s.context.length) {
        audio.currentTime = 0;
        return;
      }
      // From a queued song, "previous" returns to where the list was.
      const index = s.fromQueue ? s.index : previousIndex(s.context.length, s.index, s.repeat);
      set({ index, currentId: s.context[index]!, fromQueue: false });
      void loadCurrent(true);
    },

    ...createAudioControls(get, set, isPodcast, (rate) => usePodcasts.getState().setRate(rate)),

    toggleShuffle() {
      const s = get();
      const shuffle = !s.shuffle;
      set({ shuffle });
      // Own key: remembered even in radio mode, where persist() saves nothing.
      savePref('shuffle', shuffle);
      if (s.mode !== 'track' || s.contextInfo?.fixedOrder || s.contextShuffled === shuffle) return;
      const anchor = s.context[s.index] ?? null;
      if (shuffle) {
        const context = cycleOrder(s.original, anchor, s.contextInfo);
        set({ contextShuffled: true, context, index: anchor ? context.indexOf(anchor) : 0 });
      } else {
        const index = anchor ? Math.max(0, s.original.indexOf(anchor)) : 0;
        set({ contextShuffled: false, context: [...s.original], index });
      }
      persist();
    },

    ...createListActions(get, set, persist),
    playStation(station, list) {
      persist();
      set({ stationList: list ?? [station] });
      void startRadio(station);
    },
  };
});

/* ---------- Media Session (lock screen & notification controls) ---------- */

const {
  keepAwake,
  renewAwake,
  setPlaybackState,
  updatePositionState,
  updateMediaSession,
  setStalled,
  setRetryHandler,
} = createMediaSession(audio, () => usePlayer.getState());

/* ---------- Stall recovery (silent retries; gives up by pausing) ---------- */

const stallWatchdog = attachStallRecovery(audio, {
  mode: () => usePlayer.getState().mode,
  currentId: () => usePlayer.getState().currentId,
  reloadCurrent: () => void engine.reloadCurrent(),
  onGiveUp: () => usePlayer.setState({ buffering: false }),
  setStalled,
  setRetryHandler,
});

/* ---------- Media element events and library links ---------- */

attachAudioEvents({
  store: usePlayer,
  isPodcast,
  advance: (auto) => engine.advance(auto),
  persist: () => engine.persist(),
  retryRadio: () => engine.retryRadio(),
  retryStalledNow: () => stallWatchdog.retryNow(),
  keepAwake,
  setPlaybackState,
  updatePositionState,
});
linkPlayerToLibrary({
  store: usePlayer,
  forgetTracks: (removed) => engine.forgetTracks(removed),
  persist: () => engine.persist(),
});

window.addEventListener('pagehide', () => engine.persist());
setInterval(() => {
  if (audio.paused) return;
  engine.persist();
  renewAwake();
}, 15_000);

/** For the UI: the track currently loaded in the player. */
export function useCurrentTrackId(): string | null {
  return usePlayer((s) => (s.mode === 'track' ? s.currentId : null));
}
