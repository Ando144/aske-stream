import { t } from '../i18n';
import { savePref } from '../lib/storage';
import { isNative } from '../native/platform';
import type { usePlayer } from '../stores/player';
import { LISTENED_THRESHOLD, useOffline } from '../stores/offline';
import { usePodcasts } from '../stores/podcasts';
import { toast } from '../stores/ui';
import { isMidSongNetworkError } from './stallWatchdog';
import { audio, rt } from './runtime';

export interface AudioEventDeps {
  store: Pick<typeof usePlayer, 'getState' | 'setState'>;
  isPodcast: (id: string | null) => boolean;
  advance: (auto: boolean) => void;
  persist: () => void;
  /** Retries the original http:// stream after the https:// variant failed. */
  retryRadio: () => boolean;
  retryStalledNow: () => void;
  keepAwake: (on: boolean) => void;
  setPlaybackState: (state: 'playing' | 'paused') => void;
  updatePositionState: () => void;
}

const POSITION_GAP_MS = 250;
const PODCAST_SAVE_GAP_MS = 5000;
const MAX_CONSECUTIVE_ERRORS = 3;
const SKIP_DELAY_MS = 1200;

const finiteDuration = () => (Number.isFinite(audio.duration) ? audio.duration : 0);

function attachProgress(deps: AudioEventDeps): void {
  const { store } = deps;
  let lastPositionUpdate = 0;
  let lastPodcastSave = 0;
  audio.addEventListener('timeupdate', () => {
    const now = performance.now();
    const { mode, currentId: id } = store.getState();
    if (mode === 'track' && id && !rt.listenedMarked && audio.duration > 0) {
      if (audio.currentTime / audio.duration >= LISTENED_THRESHOLD) {
        rt.listenedMarked = true;
        void useOffline.getState().markListened(id);
      }
    }
    if (
      mode === 'track' &&
      id &&
      deps.isPodcast(id) &&
      now - lastPodcastSave > PODCAST_SAVE_GAP_MS
    ) {
      lastPodcastSave = now;
      usePodcasts.getState().save(id, audio.currentTime, audio.duration || 0);
    }
    if (now - lastPositionUpdate < POSITION_GAP_MS) return;
    lastPositionUpdate = now;
    store.setState({ position: audio.currentTime });
    deps.updatePositionState();
  });
  audio.addEventListener('loadedmetadata', () => {
    rt.reloading = false;
    if (rt.pendingSeek !== null) {
      audio.currentTime = rt.pendingSeek;
      rt.pendingSeek = null;
    }
    store.setState({ duration: finiteDuration() });
  });
  audio.addEventListener('durationchange', () => store.setState({ duration: finiteDuration() }));
}

function attachPlayState(deps: AudioEventDeps): void {
  const { store } = deps;
  audio.addEventListener('play', () => {
    store.setState({ isPlaying: true });
    deps.setPlaybackState('playing');
  });
  audio.addEventListener('playing', () => {
    rt.consecutiveErrors = 0;
    store.setState({ buffering: false, isPlaying: true });
    // The source may have switched between local and remote while already playing.
    if (isNative) deps.keepAwake(true);
    deps.setPlaybackState('playing');
  });
  audio.addEventListener('waiting', () => store.setState({ buffering: true }));
  audio.addEventListener('pause', () => {
    rt.reloading = false; // a pause (user or watchdog give-up) ends any reload in flight
    store.setState({ isPlaying: false, buffering: false });
    deps.setPlaybackState('paused');
    const s = store.getState();
    if (s.mode === 'track' && deps.isPodcast(s.currentId)) {
      usePodcasts.getState().save(s.currentId!, audio.currentTime, audio.duration || 0);
    }
    deps.persist();
  });
  audio.addEventListener('volumechange', () => {
    store.setState({ volume: audio.volume, muted: audio.muted });
    savePref('volume', { volume: audio.volume, muted: audio.muted });
  });
}

function attachEnded(deps: AudioEventDeps): void {
  audio.addEventListener('ended', () => {
    const s = deps.store.getState();
    if (s.mode !== 'track') return;
    if (deps.isPodcast(s.currentId)) {
      usePodcasts.getState().save(s.currentId!, audio.duration, audio.duration);
    }
    if (s.repeat === 'one') {
      audio.currentTime = 0;
      rt.listenedMarked = false;
      void audio.play();
      return;
    }
    deps.advance(true);
  });
}

function attachError(deps: AudioEventDeps): void {
  const { store } = deps;
  audio.addEventListener('error', () => {
    const s = store.getState();
    if (!audio.src && !rt.hls) return;
    const code = audio.error?.code ?? null;
    const midSong = { code, mode: s.mode, currentTime: audio.currentTime, reloading: rt.reloading };
    if (isMidSongNetworkError(midSong)) {
      deps.retryStalledNow();
      return;
    }
    if (s.mode === 'radio') {
      // The https:// variant of an http:// stream failed: try the original once.
      if (deps.retryRadio()) return;
      store.setState({ isPlaying: false, buffering: false });
      const httpOnly = s.station?.streamUrl.startsWith('http://');
      toast(httpOnly ? t('radio.httpOnly') : t('radio.streamError'), 'error');
      return;
    }
    store.setState({ isPlaying: false, buffering: false });
    toast(t('toast.playbackError'), 'error');
    // Skip broken songs, but never loop forever over a fully broken list.
    if (++rt.consecutiveErrors < MAX_CONSECUTIVE_ERRORS && s.context.length + s.queue.length > 1) {
      // If the song was deleted meanwhile, the library listener already moved on: don't skip twice.
      const failedSrc = audio.currentSrc;
      setTimeout(() => {
        if (audio.currentSrc === failedSrc) deps.advance(true);
      }, SKIP_DELAY_MS);
    }
  });
}

/** Connects the <audio> element events to the player store. */
export function attachAudioEvents(deps: AudioEventDeps): void {
  attachProgress(deps);
  attachPlayState(deps);
  attachEnded(deps);
  attachError(deps);
}
