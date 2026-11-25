import type { RepeatMode } from './queue';
import type { ShuffleCycles } from './shuffleCycle';

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
  /** The list follows the whole library: songs added later join the upcoming ones. */
  live?: 'library';
  /** Memory key of the shuffle cycle; defaults to `path` or `label`. */
  cycleKey?: string;
  /** The list is never shuffled (podcasts). */
  fixedOrder?: boolean;
}

export interface PlayerState {
  mode: 'idle' | 'track' | 'radio';
  currentId: string | null;
  fromQueue: boolean;
  queue: string[];
  context: string[];
  /** Context order before shuffling, restored when shuffle is turned off. */
  original: string[];
  index: number;
  contextInfo: PlayContext | null;
  /** Songs already heard in shuffle, per list. */
  shuffleCycles: ShuffleCycles;
  /** Global preference shown by the shuffle switch. */
  shuffle: boolean;
  /** Whether the list that is playing is shuffled (podcasts and study mode leave `shuffle` alone). */
  contextShuffled: boolean;
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

/** What `persist()` stores under `player-v2`. */
export interface SavedPlayer {
  currentId: string | null;
  fromQueue: boolean;
  queue: string[];
  context: string[];
  original: string[];
  index: number;
  /** Means `contextShuffled`; the name is kept for compatibility with saved data. */
  shuffle: boolean;
  repeat: RepeatMode;
  position: number;
  contextInfo: PlayContext | null;
  shuffleCycles?: ShuffleCycles;
}
