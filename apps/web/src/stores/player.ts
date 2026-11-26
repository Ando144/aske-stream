import { create } from 'zustand';
import { t } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { nextIndex, orderForDataSaver, previousIndex, withoutTracks } from '../player/queue';
import {
  avoidOpeningWith,
  cycleFor,
  cycleKey,
  LIBRARY_CYCLE_KEY,
  newSeed,
  recordPlayed,
  rememberCycle,
  reseedAll,
  roundOrder,
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

const savingData = () => usePrefs.getState().dataSaver && navigator.onLine;

const librarySongIds = () =>
  Object.values(useLibrary.getState().tracks)
    .filter((track) => track.kind !== 'podcast')
    .map((track) => track.id);

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
    // A filtered library list must not end the round of the whole library.
    const roundIds = key === LIBRARY_CYCLE_KEY ? librarySongIds() : s.original;
    const cycle = recordPlayed(cycleFor(s.shuffleCycles, key, now), id, roundIds);
    set({ shuffleCycles: rememberCycle(s.shuffleCycles, cycle, now) });
  }

  /** The round of a list, created (with its seed) the first time it is needed. */
  function seededCycle(ctx: PlayContext | null) {
    const now = Date.now();
    const stored = cycleFor(get().shuffleCycles, cycleKey(ctx), now);
    const cycle = { ...stored, seed: stored.seed ?? newSeed() };
    set({ shuffleCycles: rememberCycle(get().shuffleCycles, cycle, now) });
    return cycle;
  }

  /** Fixed order of the round; with data saver, unheard offline songs go before streamed ones. */
  function shuffledOrder(ids: string[], firstId: string | null, ctx: PlayContext | null) {
    const cycle = seededCycle(ctx);
    const played = new Set(cycle.played);
    let order = roundOrder(ids, firstId, played, cycle.seed);
    if (savingData()) {
      const head = order[0] === firstId ? 1 : 0;
      const unheard = order.slice(head).filter((id) => !played.has(id));
      order = [
        ...order.slice(0, head),
        ...orderForDataSaver(unheard, availableOffline, false),
        ...order.slice(head + unheard.length),
      ];
    }
    // After a finished round, the song that has just played must not open the list.
    const mayRepeat = !firstId && (!played.size || played.has(order[0]!));
    return mayRepeat ? avoidOpeningWith(order, get().currentId) : order;
  }

  /** Sorts the playing list by its round, keeping the song at the cursor first. */
  function reorderFromCursor() {
    const s = get();
    const anchor = s.context[s.index] ?? null;
    const context = shuffledOrder(s.original, anchor, s.contextInfo);
    const index = anchor ? Math.max(0, context.indexOf(anchor)) : 0;
    set({ contextShuffled: true, context, index });
  }

  /** persist() saves nothing in radio mode, so there only the rounds are patched. */
  function persistRounds() {
    if (get().mode !== 'radio') return persist();
    const stored = loadValue<SavedPlayer | null>('player-v2', null);
    if (stored) savePref('player-v2', { ...stored, shuffleCycles: get().shuffleCycles });
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
      const context = shuffledOrder(s.original, null, s.contextInfo);
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
      if (shuffle) {
        context = shuffledOrder(ids, startId, opts.context ?? null);
      } else if (!startId && savingData()) {
        context = orderForDataSaver(ids, availableOffline, false);
      } else {
        context = [...ids];
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

    previous(opts?: { skipRestart?: boolean }) {
      const s = get();
      if (s.mode === 'radio') {
        const prev = stationAt(s.stationList, s.station?.key, -1);
        if (prev) void startRadio(prev);
        return;
      }
      const restart = !opts?.skipRestart && audio.currentTime > 3;
      if (restart || !s.context.length) {
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
      if (shuffle) {
        reorderFromCursor();
      } else {
        const anchor = s.context[s.index] ?? null;
        const index = anchor ? Math.max(0, s.original.indexOf(anchor)) : 0;
        set({ contextShuffled: false, context: [...s.original], index });
      }
      persist();
    },

    reshuffle() {
      set({ shuffleCycles: reseedAll(get().shuffleCycles) });
      if (get().mode === 'track' && get().contextShuffled) reorderFromCursor();
      persistRounds();
      toast(t('toast.reshuffled'));
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
