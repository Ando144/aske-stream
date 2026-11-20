import { create } from 'zustand';
import type Hls from 'hls.js';
import { t } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import {
  insertAfter,
  moveItem,
  nextIndex,
  orderForDataSaver,
  previousIndex,
  reshuffleForNextLap,
  shuffleKeepingFirst,
  withoutTracks,
  type RepeatMode,
} from '../player/queue';
import { resolveAudio, resolveCoverDataUrl } from '../storage/media';
import { useLibrary } from './library';
import { LISTENED_THRESHOLD, setProtectedProvider, useOffline } from './offline';
import { resumePosition, usePodcasts } from './podcasts';
import { usePrefs } from './prefs';
import { catalog } from './radio';
import { toast } from './ui';
import { AskeNative } from '../native/askeNative';
import { mediaControls } from '../native/mediaControls';
import { isNative } from '../native/platform';
import { isStreamingSource, mayRotateOfflineNow } from '../lib/power';
import { createRunThrottle } from '../offline/runThrottle';

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

export interface RadioItem {
  key: string;
  name: string;
  streamUrl: string;
  favicon: string;
  hls: boolean;
  rbUuid: string | null;
  subtitle: string;
}

export interface PlayContext {
  label: string;
  path?: string;
}

interface PlayerState {
  mode: 'idle' | 'track' | 'radio';
  currentId: string | null;
  fromQueue: boolean;
  queue: string[];
  context: string[];
  /** Context order before shuffling, restored when shuffle is turned off. */
  original: string[];
  index: number;
  contextInfo: PlayContext | null;
  shuffle: boolean;
  repeat: RepeatMode;
  isPlaying: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  station: RadioItem | null;
  stationList: RadioItem[];

  playTracks: (
    ids: string[],
    startId?: string | null,
    opts?: { shuffle?: boolean; context?: PlayContext },
  ) => void;
  playAt: (contextIndex: number) => void;
  playFromQueue: (queueIndex: number) => void;
  togglePlay: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRate: (rate: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (ids: string[]) => void;
  addToQueue: (ids: string[]) => void;
  removeFromQueue: (queueIndex: number) => void;
  clearQueue: () => void;
  moveInQueue: (from: number, to: number) => void;
  /** Indices relative to the "Next from…" list (context after the current song). */
  moveUpcoming: (from: number, to: number) => void;
  removeUpcoming: (upcomingIndex: number) => void;
  playStation: (station: RadioItem, list?: RadioItem[]) => void;
}

const audio = new Audio();
audio.preload = 'auto';

const RUN_MIN_GAP_MS = 10 * 60 * 1000;
/** Offline rotation after loading a song, at most every 10 min; in the background only if cheap. */
const scheduleRunThrottled = createRunThrottle({
  minGapMs: RUN_MIN_GAP_MS,
  mayRun: () => mayRotateOfflineNow(usePlayer.getState().isPlaying),
  run: () => useOffline.getState().scheduleRun(5000),
});
let hls: Hls | null = null;
let objectUrl: string | null = null;
let loadSeq = 0;
let pendingSeek: number | null = null;
let listenedMarked = false;
let consecutiveErrors = 0;
let triedHttpsUpgrade = false;

interface Saved {
  currentId: string | null;
  fromQueue: boolean;
  queue: string[];
  context: string[];
  original: string[];
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  position: number;
  contextInfo: PlayContext | null;
}
const saved = loadValue<Saved | null>('player-v2', null);
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
};

export const usePlayer = create<PlayerState>((set, get) => {
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
      shuffle: s.shuffle,
      repeat: s.repeat,
      position: audio.currentTime || s.position,
      contextInfo: s.contextInfo,
    } satisfies Saved);
  }

  function resetSource() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  /** Device file → offline cache → cloud stream (see storage/media.ts). */
  async function sourceFor(trackId: string): Promise<string | null> {
    const track = useLibrary.getState().tracks[trackId];
    if (!track) return null;
    return resolveAudio(track, !!useOffline.getState().entries[trackId]);
  }

  /** Loads `currentId`; if it cannot play offline, moves on to the next playable song. */
  async function loadCurrent(autoplay: boolean, startAt = 0): Promise<void> {
    const seq = ++loadSeq;
    let src: string | null = null;
    for (let tries = 0; tries < get().context.length + get().queue.length + 1; tries++) {
      const id = get().currentId;
      if (id) src = await sourceFor(id);
      if (seq !== loadSeq) {
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
    if (src.startsWith('blob:')) objectUrl = src;
    listenedMarked = false;
    const id = get().currentId!;
    const podcast = isPodcast(id);
    if (podcast && startAt === 0) startAt = resumePosition(id);
    pendingSeek = startAt > 0 ? startAt : null;
    const rate = podcast ? usePodcasts.getState().rate : 1;
    set({ mode: 'track', station: null, position: startAt, duration: 0, rate });
    audio.src = src;
    audio.playbackRate = rate;
    audio.defaultPlaybackRate = rate;
    updateMediaSession();
    persist();
    scheduleRunThrottled();
    if (autoplay) audio.play().catch(() => set({ isPlaying: false }));
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
    const ni = nextIndex(
      s.context.length,
      s.index,
      s.repeat === 'off' && userAction ? 'off' : s.repeat,
    );
    if (ni === null) return false;
    if (ni === 0 && s.shuffle && s.context.length > 1) {
      const context = reshuffleForNextLap(s.original, s.context[s.index] ?? null);
      set({ context, index: 0, currentId: context[0]!, fromQueue: false });
      return true;
    }
    set({ index: ni, currentId: s.context[ni]!, fromQueue: false });
    return true;
  }

  async function startRadio(item: RadioItem, forceUrl?: string) {
    if (!navigator.onLine) {
      toast(t('radio.offline'), 'error');
      return;
    }
    const seq = ++loadSeq;
    resetSource();
    let url = forceUrl ?? item.streamUrl;
    // Web apps served over HTTPS cannot play http:// streams; try the https variant first.
    triedHttpsUpgrade = false;
    if (!forceUrl && url.startsWith('http://') && location.protocol === 'https:') {
      url = `https://${url.slice('http://'.length)}`;
      triedHttpsUpgrade = true;
    }
    set({ mode: 'radio', station: item, position: 0, duration: 0, buffering: true, rate: 1 });
    audio.playbackRate = 1;
    const isHls = item.hls || /\.m3u8(\?|$)/i.test(url);
    if (isHls && !audio.canPlayType('application/vnd.apple.mpegurl')) {
      const { default: HlsLib } = await import('hls.js/light');
      if (seq !== loadSeq) return;
      if (HlsLib.isSupported()) {
        hls = new HlsLib({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(url);
        hls.attachMedia(audio);
      } else {
        audio.src = url;
      }
    } else {
      audio.src = url;
    }
    updateMediaSession();
    audio.play().catch(() => set({ isPlaying: false, buffering: false }));
    if (item.rbUuid && !forceUrl) void catalog.click(item.rbUuid);
  }

  function advance(auto: boolean) {
    const s = get();
    if (s.mode === 'radio') {
      const list = s.stationList;
      const i = list.findIndex((x) => x.key === s.station?.key);
      if (list.length > 1) void startRadio(list[(i + 1) % list.length]!);
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
        loadSeq++;
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
  (engine as typeof engine & { retryRadio?: () => boolean }).retryRadio = () => {
    const st = get().station;
    if (!st || !triedHttpsUpgrade) return false;
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
    shuffle: saved?.shuffle ?? false,
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
      const shuffle = opts.shuffle ?? get().shuffle;
      let context: string[];
      if (!startId && usePrefs.getState().dataSaver && navigator.onLine) {
        context = orderForDataSaver(ids, availableOffline, shuffle);
      } else {
        const first = startId ?? (shuffle ? null : ids[0]!);
        context = shuffle ? shuffleKeepingFirst(ids, first) : [...ids];
      }
      const index = startId ? Math.max(0, context.indexOf(startId)) : 0;
      consecutiveErrors = 0;
      set({
        context,
        original: [...ids],
        index,
        currentId: context[index]!,
        fromQueue: false,
        shuffle,
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
      if (audio.paused) {
        if (s.mode === 'radio' && s.station) void startRadio(s.station);
        else audio.play().catch(() => set({ isPlaying: false }));
      } else {
        audio.pause();
      }
    },

    pause: () => audio.pause(),
    next: () => advance(false),

    previous() {
      const s = get();
      if (s.mode === 'radio') {
        const list = s.stationList;
        const i = list.findIndex((x) => x.key === s.station?.key);
        if (list.length > 1) void startRadio(list[(i - 1 + list.length) % list.length]!);
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

    seek(seconds) {
      if (get().mode !== 'track') return;
      if (!audio.src) {
        set({ position: seconds });
        return;
      }
      const d = audio.duration;
      audio.currentTime = Math.max(0, Number.isFinite(d) ? Math.min(seconds, d - 0.25) : seconds);
      set({ position: audio.currentTime });
    },

    seekBy(delta) {
      get().seek(audio.currentTime + delta);
    },

    setVolume(volume) {
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.muted = false;
    },

    toggleMute() {
      audio.muted = !audio.muted;
    },

    setRate(rate) {
      audio.playbackRate = rate;
      audio.defaultPlaybackRate = rate;
      if (isPodcast(get().currentId)) usePodcasts.getState().setRate(rate);
      set({ rate });
    },

    toggleShuffle() {
      const s = get();
      const anchor = s.context[s.index] ?? null;
      if (!s.shuffle) {
        const context = shuffleKeepingFirst(s.original, anchor);
        set({ shuffle: true, context, index: anchor ? context.indexOf(anchor) : 0 });
      } else {
        const index = anchor ? Math.max(0, s.original.indexOf(anchor)) : 0;
        set({ shuffle: false, context: [...s.original], index });
      }
      persist();
    },

    cycleRepeat() {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length]! });
      persist();
    },

    playNext(ids) {
      const s = get();
      if (s.mode !== 'track' || !s.currentId) {
        get().playTracks(ids);
        return;
      }
      set({ queue: insertAfter(s.queue, -1, ids) });
      persist();
      toast(t('toast.playNext'));
    },

    addToQueue(ids) {
      const s = get();
      if (s.mode !== 'track' || !s.currentId) {
        get().playTracks(ids);
        return;
      }
      set({ queue: [...s.queue, ...ids] });
      persist();
      toast(
        ids.length === 1
          ? t('toast.addedToQueue')
          : t('toast.addedManyToQueue', { count: ids.length }),
      );
    },

    removeFromQueue(queueIndex) {
      set({ queue: get().queue.filter((_, i) => i !== queueIndex) });
      persist();
    },

    clearQueue() {
      set({ queue: [] });
      persist();
    },

    moveInQueue(from, to) {
      set({ queue: moveItem(get().queue, from, to) });
      persist();
    },

    moveUpcoming(from, to) {
      const s = get();
      const base = s.index + 1;
      const context = moveItem(s.context, base + from, base + to);
      set(s.shuffle ? { context } : { context, original: [...context] });
      persist();
    },

    removeUpcoming(upcomingIndex) {
      const s = get();
      const at = s.index + 1 + upcomingIndex;
      const id = s.context[at];
      const context = s.context.filter((_, i) => i !== at);
      const oi = id ? s.original.indexOf(id) : -1;
      const original = oi >= 0 ? s.original.filter((_, i) => i !== oi) : s.original;
      set({ context, original });
      persist();
    },

    playStation(station, list) {
      persist();
      set({ stationList: list ?? [station] });
      void startRadio(station);
    },
  };
});

/* ---------- Media element events → store ---------- */

let lastPositionUpdate = 0;
let lastPodcastSave = 0;
audio.addEventListener('timeupdate', () => {
  const now = performance.now();
  const s = usePlayer.getState();
  const id = s.currentId;
  if (s.mode === 'track' && id && !listenedMarked && audio.duration > 0) {
    if (audio.currentTime / audio.duration >= LISTENED_THRESHOLD) {
      listenedMarked = true;
      void useOffline.getState().markListened(id);
    }
  }
  if (s.mode === 'track' && id && isPodcast(id) && now - lastPodcastSave > 5000) {
    lastPodcastSave = now;
    usePodcasts.getState().save(id, audio.currentTime, audio.duration || 0);
  }
  if (now - lastPositionUpdate < 250) return;
  lastPositionUpdate = now;
  usePlayer.setState({ position: audio.currentTime });
  updatePositionState();
});
audio.addEventListener('loadedmetadata', () => {
  if (pendingSeek !== null) {
    audio.currentTime = pendingSeek;
    pendingSeek = null;
  }
  usePlayer.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
});
audio.addEventListener('durationchange', () =>
  usePlayer.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }),
);
audio.addEventListener('play', () => {
  usePlayer.setState({ isPlaying: true });
  setPlaybackState('playing');
});
audio.addEventListener('playing', () => {
  consecutiveErrors = 0;
  usePlayer.setState({ buffering: false, isPlaying: true });
  // The source may have switched between local and remote while already playing.
  if (isNative) keepAwake(true);
});
audio.addEventListener('waiting', () => usePlayer.setState({ buffering: true }));
audio.addEventListener('pause', () => {
  usePlayer.setState({ isPlaying: false, buffering: false });
  setPlaybackState('paused');
  const s = usePlayer.getState();
  if (s.mode === 'track' && isPodcast(s.currentId)) {
    usePodcasts.getState().save(s.currentId!, audio.currentTime, audio.duration || 0);
  }
  engine.persist();
});
audio.addEventListener('ended', () => {
  const s = usePlayer.getState();
  if (s.mode !== 'track') return;
  if (isPodcast(s.currentId))
    usePodcasts.getState().save(s.currentId!, audio.duration, audio.duration);
  if (s.repeat === 'one') {
    audio.currentTime = 0;
    listenedMarked = false;
    void audio.play();
    return;
  }
  engine.advance(true);
});
audio.addEventListener('volumechange', () => {
  usePlayer.setState({ volume: audio.volume, muted: audio.muted });
  savePref('volume', { volume: audio.volume, muted: audio.muted });
});
audio.addEventListener('error', () => {
  const s = usePlayer.getState();
  if (!audio.src && !hls) return;
  if (s.mode === 'radio') {
    // The https:// variant of an http:// stream failed: try the original once.
    const retry = (engine as typeof engine & { retryRadio?: () => boolean }).retryRadio;
    if (retry?.()) return;
    usePlayer.setState({ isPlaying: false, buffering: false });
    toast(
      s.station?.streamUrl.startsWith('http://') ? t('radio.httpOnly') : t('radio.streamError'),
      'error',
    );
    return;
  }
  usePlayer.setState({ isPlaying: false, buffering: false });
  toast(t('toast.playbackError'), 'error');
  // Skip broken songs, but never loop forever over a fully broken list.
  if (++consecutiveErrors < 3 && s.context.length + s.queue.length > 1) {
    // If the song was deleted meanwhile, the library listener already moved on: don't skip twice.
    const failedSrc = audio.currentSrc;
    setTimeout(() => {
      if (audio.currentSrc === failedSrc) engine.advance(true);
    }, 1200);
  }
});

/** Deleting the playing song (or any queued one) must not leave the player on a ghost. */
useLibrary.subscribe((state, prev) => {
  if (state.tracks === prev.tracks) return;
  const removed = new Set(Object.keys(prev.tracks).filter((id) => !(id in state.tracks)));
  if (!removed.size) return;
  const p = usePlayer.getState();
  const used = [p.currentId, ...p.context, ...p.queue].some((id) => id !== null && removed.has(id));
  if (used) engine.forgetTracks(removed);
});

window.addEventListener('pagehide', () => engine.persist());
setInterval(() => {
  if (audio.paused) return;
  engine.persist();
  renewAwake();
}, 15_000);

/* ---------- Media Session (lock screen & notification controls) ---------- */

const controls = mediaControls;
const FALLBACK_ART = [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }];

function setPlaybackState(state: 'none' | 'paused' | 'playing') {
  controls?.setPlaybackState(state);
  if (isNative) keepAwake(state === 'playing');
}

/** Wake/Wi-Fi locks in the Android app; the native side delays the release itself. */
let awake = false;
let awakeStreaming = false;
function keepAwake(playing: boolean) {
  if (!playing) {
    awake = false;
    void AskeNative.keepAwake({ playing: false }).catch(() => undefined);
    return;
  }
  // hls.js feeds radios through a blob: URL, so the source alone can't tell it is a stream.
  const streaming = usePlayer.getState().mode === 'radio' || isStreamingSource(audio.currentSrc);
  if (awake && streaming === awakeStreaming) return;
  awake = true;
  awakeStreaming = streaming;
  lastAwakeCall = Date.now();
  void AskeNative.keepAwake({ playing: true, streaming }).catch(() => undefined);
}

/** The native wake lock expires after 30 min, so renew it every 10 min while music plays. */
const AWAKE_RENEW_MS = 10 * 60 * 1000;
let lastAwakeCall = 0;
function renewAwake() {
  if (!isNative || !awake || Date.now() - lastAwakeCall < AWAKE_RENEW_MS) return;
  lastAwakeCall = Date.now();
  void AskeNative.keepAwake({ playing: true, streaming: awakeStreaming }).catch(() => undefined);
}

let lastPositionState = 0;
function updatePositionState() {
  if (!controls || usePlayer.getState().mode !== 'track') return;
  const now = performance.now();
  if (now - lastPositionState < 1000) return;
  lastPositionState = now;
  const d = audio.duration;
  if (!Number.isFinite(d) || d <= 0) return;
  controls.setPositionState({
    duration: d,
    playbackRate: audio.playbackRate,
    position: Math.min(audio.currentTime, d),
  });
}

function updateMediaSession() {
  if (!controls) return;
  const s = usePlayer.getState();
  if (s.mode === 'radio' && s.station) {
    controls.setMetadata({
      title: s.station.name,
      artist: t('player.live'),
      album: t('player.radio'),
      artwork: s.station.favicon ? [{ src: s.station.favicon }] : FALLBACK_ART,
    });
    for (const action of ['seekto', 'seekbackward', 'seekforward'] as const) {
      controls.setActionHandler(action, null);
    }
    return;
  }
  const track = s.currentId ? useLibrary.getState().tracks[s.currentId] : undefined;
  if (!track) return;
  const info = { title: track.title, artist: track.artist, album: track.album };
  controls.setMetadata({ ...info, artwork: FALLBACK_ART });
  setSeekHandlers(track.kind === 'podcast' ? 15 : 10);
  if (track.hasCover) {
    void resolveCoverDataUrl(track).then((src) => {
      if (src && usePlayer.getState().currentId === track.id) {
        controls.setMetadata({
          ...info,
          artwork: [{ src, sizes: '512x512', type: 'image/jpeg' }],
        });
      }
    });
  }
}

function setSeekHandlers(step = 10) {
  if (!controls) return;
  const player = () => usePlayer.getState();
  controls.setActionHandler('seekto', (d) => {
    if (d.seekTime !== undefined && d.seekTime !== null) player().seek(d.seekTime);
  });
  controls.setActionHandler('seekbackward', (d) => player().seekBy(-(d.seekOffset ?? step)));
  controls.setActionHandler('seekforward', (d) => player().seekBy(d.seekOffset ?? step * 2));
}

if (controls) {
  const player = () => usePlayer.getState();
  controls.setActionHandler('play', () => {
    if (!player().isPlaying) player().togglePlay();
  });
  controls.setActionHandler('pause', () => player().pause());
  controls.setActionHandler('stop', () => player().pause());
  controls.setActionHandler('previoustrack', () => player().previous());
  controls.setActionHandler('nexttrack', () => player().next());
  setSeekHandlers();
}

/* ---------- Offline cache integration ---------- */

// Never rotate out the song that is playing or the one coming next.
setProtectedProvider(() => {
  const s = usePlayer.getState();
  const ids = new Set<string>();
  if (s.mode === 'track') {
    if (s.currentId) ids.add(s.currentId);
    const nextId = s.queue[0] ?? s.context[s.index + 1];
    if (nextId) ids.add(nextId);
  }
  return ids;
});

/** For the UI: the track currently loaded in the player. */
export function useCurrentTrackId(): string | null {
  return usePlayer((s) => (s.mode === 'track' ? s.currentId : null));
}
