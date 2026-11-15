import { create } from 'zustand';
import type Hls from 'hls.js';
import { api, audioUrl, coverUrl } from '../api/client';
import { t } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { getAudioBlob } from '../offline/audioCache';
import {
  insertAfter,
  nextIndex,
  previousIndex,
  reshuffleForNextLap,
  shuffleKeepingFirst,
  type RepeatMode,
} from '../player/queue';
import { useLibrary } from './library';
import { LISTENED_THRESHOLD, setProtectedProvider, useOffline } from './offline';
import { toast } from './ui';

/**
 * Playback engine + state.
 *
 * One <audio> element lives for the whole app session. Using a plain media
 * element (no Web Audio graph) is what lets Android keep playing with the
 * screen off and show the lock-screen / notification controls through the
 * Media Session API.
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
  queue: string[];
  /** Queue order before shuffling, restored when shuffle is turned off. */
  original: string[];
  index: number;
  context: PlayContext | null;
  shuffle: boolean;
  repeat: RepeatMode;
  isPlaying: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  station: RadioItem | null;
  stationList: RadioItem[];

  playTracks: (
    ids: string[],
    startId?: string | null,
    opts?: { shuffle?: boolean; context?: PlayContext },
  ) => void;
  playAt: (index: number) => void;
  togglePlay: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (ids: string[]) => void;
  addToQueue: (ids: string[]) => void;
  playStation: (station: RadioItem, list?: RadioItem[]) => void;
}

const audio = new Audio();
audio.preload = 'auto';
let hls: Hls | null = null;
let objectUrl: string | null = null;
let loadSeq = 0;
let pendingSeek: number | null = null;
let listenedMarked = false;
let consecutiveErrors = 0;

interface Saved {
  queue: string[];
  original: string[];
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  position: number;
  context: PlayContext | null;
}
const saved = loadValue<Saved | null>('player', null);
const savedVolume = loadValue<{ volume: number; muted: boolean }>('volume', {
  volume: 1,
  muted: false,
});
audio.volume = savedVolume.volume;
audio.muted = savedVolume.muted;

/** Engine internals the media-element listeners below need to call. */
const engine = {
  advance: (_auto: boolean): void => undefined,
  persist: (): void => undefined,
};

export const usePlayer = create<PlayerState>((set, get) => {
  const currentId = () => (get().mode === 'track' ? (get().queue[get().index] ?? null) : null);

  function persist() {
    const s = get();
    if (s.mode === 'radio') return;
    savePref('player', {
      queue: s.queue,
      original: s.original,
      index: s.index,
      shuffle: s.shuffle,
      repeat: s.repeat,
      position: audio.currentTime || s.position,
      context: s.context,
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

  async function sourceFor(trackId: string): Promise<string | null> {
    if (!useLibrary.getState().tracks[trackId]) return null;
    if (useOffline.getState().entries[trackId]) {
      const blob = await getAudioBlob(trackId);
      if (blob) return URL.createObjectURL(blob);
    }
    return navigator.onLine ? audioUrl(trackId) : null;
  }

  /** Loads queue[index]; skips forward over songs that cannot play offline. */
  async function loadCurrent(autoplay: boolean, startAt = 0): Promise<void> {
    const seq = ++loadSeq;
    const { queue } = get();
    let index = get().index;
    let src: string | null = null;
    for (let tries = 0; tries < queue.length; tries++) {
      const id = queue[index];
      if (id) src = await sourceFor(id);
      if (seq !== loadSeq) {
        if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
        return;
      }
      if (src) break;
      const ni = nextIndex(queue.length, index, 'all');
      if (ni === null) break;
      index = ni;
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
    pendingSeek = startAt > 0 ? startAt : null;
    set({ index, mode: 'track', station: null, position: startAt, duration: 0 });
    audio.src = src;
    updateMediaSession();
    persist();
    useOffline.getState().scheduleRun(5000);
    if (autoplay) {
      audio.play().catch(() => set({ isPlaying: false }));
    }
  }

  async function startRadio(item: RadioItem) {
    if (!navigator.onLine) {
      toast(t('radio.offline'), 'error');
      return;
    }
    const seq = ++loadSeq;
    resetSource();
    set({ mode: 'radio', station: item, position: 0, duration: 0, buffering: true });
    const isHls = item.hls || /\.m3u8(\?|$)/i.test(item.streamUrl);
    if (isHls && !audio.canPlayType('application/vnd.apple.mpegurl')) {
      const { default: HlsLib } = await import('hls.js/light');
      if (seq !== loadSeq) return;
      if (HlsLib.isSupported()) {
        hls = new HlsLib({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(item.streamUrl);
        hls.attachMedia(audio);
      } else {
        audio.src = item.streamUrl;
      }
    } else {
      audio.src = item.streamUrl;
    }
    updateMediaSession();
    audio.play().catch(() => set({ isPlaying: false, buffering: false }));
    if (item.rbUuid) void api.countClick(item.rbUuid);
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
    const ni = nextIndex(s.queue.length, s.index, s.repeat);
    if (ni === null) {
      if (auto) {
        // End of the queue: stop on the last song, ready to replay.
        audio.pause();
        audio.currentTime = 0;
        set({ isPlaying: false, position: 0 });
      }
      return;
    }
    if (ni === 0 && s.shuffle && s.queue.length > 1) {
      set({ queue: reshuffleForNextLap(s.original, s.queue[s.index] ?? null) });
    }
    set({ index: ni });
    void loadCurrent(true);
  }

  engine.advance = advance;
  engine.persist = persist;

  return {
    mode: saved?.queue.length ? 'track' : 'idle',
    queue: saved?.queue ?? [],
    original: saved?.original ?? saved?.queue ?? [],
    index: saved?.index ?? 0,
    context: saved?.context ?? null,
    shuffle: saved?.shuffle ?? false,
    repeat: saved?.repeat ?? 'off',
    isPlaying: false,
    buffering: false,
    position: saved?.position ?? 0,
    duration: 0,
    volume: savedVolume.volume,
    muted: savedVolume.muted,
    station: null,
    stationList: [],

    playTracks(ids, startId = null, opts = {}) {
      if (!ids.length) return;
      const shuffle = opts.shuffle ?? get().shuffle;
      const first = startId ?? (shuffle ? null : ids[0]!);
      const queue = shuffle ? shuffleKeepingFirst(ids, first) : [...ids];
      const index = first ? Math.max(0, queue.indexOf(first)) : 0;
      consecutiveErrors = 0;
      set({
        queue,
        original: [...ids],
        index,
        shuffle,
        context: opts.context ?? null,
        mode: 'track',
      });
      void loadCurrent(true);
    },

    playAt(index) {
      if (index < 0 || index >= get().queue.length) return;
      set({ index });
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
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
      }
      set({ index: previousIndex(s.queue.length, s.index, s.repeat) });
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

    toggleShuffle() {
      const s = get();
      const id = currentId();
      if (!s.shuffle) {
        const queue = shuffleKeepingFirst(s.original, id);
        set({ shuffle: true, queue, index: id ? queue.indexOf(id) : 0 });
      } else {
        const index = id ? Math.max(0, s.original.indexOf(id)) : 0;
        set({ shuffle: false, queue: [...s.original], index });
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
      if (s.mode !== 'track' || !s.queue.length) {
        get().playTracks(ids);
        return;
      }
      const original = [...s.original, ...ids.filter((id) => !s.original.includes(id))];
      set({ queue: insertAfter(s.queue, s.index, ids), original });
      persist();
      toast(t('toast.playNext'));
    },

    addToQueue(ids) {
      const s = get();
      if (s.mode !== 'track' || !s.queue.length) {
        get().playTracks(ids);
        return;
      }
      const fresh = ids.filter((id) => !s.queue.slice(s.index + 1).includes(id));
      set({
        queue: [...s.queue, ...fresh],
        original: [...s.original, ...fresh.filter((id) => !s.original.includes(id))],
      });
      persist();
      toast(t('toast.addedToQueue'));
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
audio.addEventListener('timeupdate', () => {
  const now = performance.now();
  const s = usePlayer.getState();
  if (s.mode === 'track' && !listenedMarked && audio.duration > 0) {
    if (audio.currentTime / audio.duration >= LISTENED_THRESHOLD) {
      listenedMarked = true;
      const id = s.queue[s.index];
      if (id) void useOffline.getState().markListened(id);
    }
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
});
audio.addEventListener('waiting', () => usePlayer.setState({ buffering: true }));
audio.addEventListener('pause', () => {
  usePlayer.setState({ isPlaying: false, buffering: false });
  setPlaybackState('paused');
  engine.persist();
});
audio.addEventListener('ended', () => {
  const s = usePlayer.getState();
  if (s.mode !== 'track') return;
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
  usePlayer.setState({ isPlaying: false, buffering: false });
  if (s.mode === 'radio') {
    toast(t('radio.streamError'), 'error');
    return;
  }
  toast(t('toast.playbackError'), 'error');
  // Skip broken songs, but never loop forever over a fully broken queue.
  if (++consecutiveErrors < 3 && s.queue.length > 1) {
    setTimeout(() => engine.advance(true), 1200);
  }
});

window.addEventListener('pagehide', () => engine.persist());
setInterval(() => {
  if (!audio.paused) engine.persist();
}, 15_000);

/* ---------- Media Session (lock screen & notification controls) ---------- */

const hasMediaSession = 'mediaSession' in navigator;
const FALLBACK_ART = [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }];

function setPlaybackState(state: MediaSessionPlaybackState) {
  if (hasMediaSession) navigator.mediaSession.playbackState = state;
}

let lastPositionState = 0;
function updatePositionState() {
  if (!hasMediaSession || usePlayer.getState().mode !== 'track') return;
  const now = performance.now();
  if (now - lastPositionState < 1000) return;
  lastPositionState = now;
  const d = audio.duration;
  if (!Number.isFinite(d) || d <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: d,
      playbackRate: audio.playbackRate,
      position: Math.min(audio.currentTime, d),
    });
  } catch {
    // ignore transient invalid states while switching sources
  }
}

/** Covers are fetched with the session cookie and handed over as data: URLs. */
async function coverDataUrl(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(coverUrl(trackId), { credentials: 'same-origin' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function updateMediaSession() {
  if (!hasMediaSession) return;
  const s = usePlayer.getState();
  const session = navigator.mediaSession;
  if (s.mode === 'radio' && s.station) {
    session.metadata = new MediaMetadata({
      title: s.station.name,
      artist: t('player.live'),
      album: t('player.radio'),
      artwork: s.station.favicon ? [{ src: s.station.favicon }] : FALLBACK_ART,
    });
    for (const action of ['seekto', 'seekbackward', 'seekforward'] as const) {
      session.setActionHandler(action, null);
    }
    return;
  }
  const id = s.queue[s.index];
  const track = id ? useLibrary.getState().tracks[id] : undefined;
  if (!track) return;
  session.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: FALLBACK_ART,
  });
  setSeekHandlers();
  if (track.hasCover) {
    void coverDataUrl(track.id).then((src) => {
      const current = usePlayer.getState();
      if (src && current.queue[current.index] === track.id && session.metadata) {
        session.metadata.artwork = [{ src, sizes: '512x512', type: 'image/jpeg' }];
      }
    });
  }
}

function setSeekHandlers() {
  if (!hasMediaSession) return;
  const session = navigator.mediaSession;
  const player = () => usePlayer.getState();
  session.setActionHandler('seekto', (d) => {
    if (d.seekTime !== undefined) player().seek(d.seekTime);
  });
  session.setActionHandler('seekbackward', (d) => player().seekBy(-(d.seekOffset ?? 10)));
  session.setActionHandler('seekforward', (d) => player().seekBy(d.seekOffset ?? 10));
}

if (hasMediaSession) {
  const session = navigator.mediaSession;
  const player = () => usePlayer.getState();
  const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // action not supported by this browser
    }
  };
  safe('play', () => player().togglePlay());
  safe('pause', () => player().pause());
  safe('stop', () => player().pause());
  safe('previoustrack', () => player().previous());
  safe('nexttrack', () => player().next());
  setSeekHandlers();
}

/* ---------- Offline cache integration ---------- */

// Never rotate out the song that is playing or the one coming next.
setProtectedProvider(() => {
  const s = usePlayer.getState();
  const ids = new Set<string>();
  if (s.mode === 'track') {
    const cur = s.queue[s.index];
    const nxt = s.queue[s.index + 1];
    if (cur) ids.add(cur);
    if (nxt) ids.add(nxt);
  }
  return ids;
});

/** For the UI: the track currently loaded in the player. */
export function useCurrentTrackId(): string | null {
  return usePlayer((s) => (s.mode === 'track' ? (s.queue[s.index] ?? null) : null));
}
