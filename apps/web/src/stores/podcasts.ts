import { create } from 'zustand';
import { loadValue, savePref } from '../lib/storage';

export interface EpisodeProgress {
  /** Seconds listened. */
  position: number;
  duration: number;
  finished: boolean;
  updatedAt: number;
}

export const PODCAST_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
/** Within the last 3 % (or 30 s) an episode counts as finished. */
const isFinished = (position: number, duration: number) =>
  duration > 0 && (position / duration > 0.97 || duration - position < 30);

interface PodcastsState {
  progress: Record<string, EpisodeProgress>;
  rate: number;
  save: (id: string, position: number, duration: number) => void;
  setFinished: (id: string, finished: boolean) => void;
  setRate: (rate: number) => void;
}

/** Per-episode resume position and the podcast playback speed (stored on this device). */
export const usePodcasts = create<PodcastsState>((set, get) => ({
  progress: loadValue<Record<string, EpisodeProgress>>('podcast-progress', {}),
  rate: loadValue<number>('podcast-rate', 1),

  save(id, position, duration) {
    const progress = {
      ...get().progress,
      [id]: { position, duration, finished: isFinished(position, duration), updatedAt: Date.now() },
    };
    savePref('podcast-progress', progress);
    set({ progress });
  },

  setFinished(id, finished) {
    const prev = get().progress[id];
    const duration = prev?.duration ?? 0;
    const progress = {
      ...get().progress,
      [id]: { position: finished ? duration : 0, duration, finished, updatedAt: Date.now() },
    };
    savePref('podcast-progress', progress);
    set({ progress });
  },

  setRate(rate) {
    savePref('podcast-rate', rate);
    set({ rate });
  },
}));

/** Where to resume an episode, or 0 to start from the beginning. */
export function resumePosition(id: string): number {
  const p = usePodcasts.getState().progress[id];
  return p && !p.finished ? Math.max(0, p.position - 3) : 0;
}
