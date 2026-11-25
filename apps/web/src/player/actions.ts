import { t } from '../i18n';
import { toast } from '../stores/ui';
import { insertAfter, moveItem, type RepeatMode } from './queue';
import { audio } from './runtime';
import type { PlayerState } from './types';

type Get = () => PlayerState;
type Set = (partial: Partial<PlayerState>) => void;

/** Queue, "next from…" list and repeat: everything that edits lists without loading audio. */
export function createListActions(get: Get, set: Set, persist: () => void) {
  /** With nothing playing, queueing a song just starts it. */
  const startIfIdle = (ids: string[]): boolean => {
    const s = get();
    if (s.mode === 'track' && s.currentId) return false;
    s.playTracks(ids);
    return true;
  };

  return {
    cycleRepeat() {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length]! });
      persist();
    },

    playNext(ids: string[]) {
      if (startIfIdle(ids)) return;
      set({ queue: insertAfter(get().queue, -1, ids) });
      persist();
      toast(t('toast.playNext'));
    },

    addToQueue(ids: string[]) {
      if (startIfIdle(ids)) return;
      set({ queue: [...get().queue, ...ids] });
      persist();
      const many = t('toast.addedManyToQueue', { count: ids.length });
      toast(ids.length === 1 ? t('toast.addedToQueue') : many);
    },

    removeFromQueue(queueIndex: number) {
      set({ queue: get().queue.filter((_, i) => i !== queueIndex) });
      persist();
    },

    clearQueue() {
      set({ queue: [] });
      persist();
    },

    moveInQueue(from: number, to: number) {
      set({ queue: moveItem(get().queue, from, to) });
      persist();
    },

    moveUpcoming(from: number, to: number) {
      const s = get();
      const base = s.index + 1;
      const context = moveItem(s.context, base + from, base + to);
      set(s.contextShuffled ? { context } : { context, original: [...context] });
      persist();
    },

    removeUpcoming(upcomingIndex: number) {
      const s = get();
      const at = s.index + 1 + upcomingIndex;
      const id = s.context[at];
      const context = s.context.filter((_, i) => i !== at);
      const oi = id ? s.original.indexOf(id) : -1;
      const original = oi >= 0 ? s.original.filter((_, i) => i !== oi) : s.original;
      set({ context, original });
      persist();
    },
  };
}

/** Seek, volume and speed: thin wrappers over the <audio> element. */
export function createAudioControls(
  get: Get,
  set: Set,
  isPodcast: (id: string | null) => boolean,
  setPodcastRate: (rate: number) => void,
) {
  return {
    seek(seconds: number) {
      if (get().mode !== 'track') return;
      if (!audio.src) {
        set({ position: seconds });
        return;
      }
      const d = audio.duration;
      audio.currentTime = Math.max(0, Number.isFinite(d) ? Math.min(seconds, d - 0.25) : seconds);
      set({ position: audio.currentTime });
    },

    seekBy(delta: number) {
      get().seek(audio.currentTime + delta);
    },

    setVolume(volume: number) {
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.muted = false;
    },

    toggleMute() {
      audio.muted = !audio.muted;
    },

    setRate(rate: number) {
      audio.playbackRate = rate;
      audio.defaultPlaybackRate = rate;
      if (isPodcast(get().currentId)) setPodcastRate(rate);
      set({ rate });
    },
  };
}
