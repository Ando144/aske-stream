import { create } from 'zustand';
import { t, type Translate } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { usePlayer } from './player';
import { toast } from './ui';

/** Whole minutes (1 to 480 = 8 h) or "when the current song ends". */
export type SleepChoice = { minutes: number } | 'endOfTrack';
export const SLEEP_PRESETS_MIN = [15, 30, 45, 60, 90, 120, 180, 240] as const;
export const SLEEP_MAX_MIN = 480;

const FADE_MS = 20_000;
const PREF_KEY = 'sleep-timer';

interface SleepTimerState {
  /** ms since epoch; null when there is no timer or it is "end of track". */
  endsAt: number | null;
  endOfTrack: boolean;
  start: (choice: SleepChoice) => void;
  cancel: () => void;
}

/** 1 until the last `fadeMs` before `endsAt`, then down to 0. */
export function sleepVolumeFactor(now: number, endsAt: number, fadeMs = FADE_MS): number {
  return Math.min(1, Math.max(0, (endsAt - now) / fadeMs));
}

/** "1 h 20 min", "12 min" or "45 s" (last minute). */
export function formatSleepTime(ms: number, translate: Translate = t): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return translate('sleep.seconds', { count: seconds });
  const totalMinutes = Math.ceil(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(translate('sleep.hours', { count: hours }));
  if (minutes > 0) parts.push(translate('sleep.minutes', { count: minutes }));
  return parts.join(' ');
}

// Module state kept outside zustand: it is plumbing, not something the UI renders.
let interval: ReturnType<typeof setInterval> | null = null;
let unsubscribePlayer: (() => void) | null = null;
let baseVolume: number | null = null;

const clampMinutes = (minutes: number) =>
  Math.min(SLEEP_MAX_MIN, Math.max(1, Math.round(Number.isFinite(minutes) ? minutes : 1)));

function clearRuntime() {
  if (interval) clearInterval(interval);
  unsubscribePlayer?.();
  interval = null;
  unsubscribePlayer = null;
}

function restoreVolume() {
  if (baseVolume === null) return;
  usePlayer.getState().setVolume(baseVolume);
  baseVolume = null;
}

function reset() {
  clearRuntime();
  useSleepTimer.setState({ endsAt: null, endOfTrack: false });
  savePref(PREF_KEY, null);
}

function finish() {
  usePlayer.getState().pause();
  restoreVolume();
  reset();
  toast(t('sleep.stopped'));
}

function tick() {
  const { endsAt } = useSleepTimer.getState();
  if (endsAt === null) return;
  const now = Date.now();
  if (now >= endsAt) return finish();
  const factor = sleepVolumeFactor(now, endsAt);
  if (factor >= 1) return;
  baseVolume ??= usePlayer.getState().volume;
  usePlayer.getState().setVolume(baseVolume * factor);
}

function runMinutes(endsAt: number) {
  clearRuntime();
  useSleepTimer.setState({ endsAt, endOfTrack: false });
  savePref(PREF_KEY, { endsAt });
  // Polling every second instead of one long setTimeout: Android delays long
  // timers while the app is in the background.
  interval = setInterval(tick, 1000);
}

type PlayerSnapshot = ReturnType<typeof usePlayer.getState>;

/** The song was at its end and the position went back to the start (repeat one, or queue over). */
function wrappedAround(state: PlayerSnapshot, prev: PlayerSnapshot): boolean {
  return (
    prev.duration > 0 &&
    prev.position >= prev.duration - 3 &&
    state.position < prev.position &&
    state.position < 1
  );
}

function runEndOfTrack() {
  clearRuntime();
  useSleepTimer.setState({ endsAt: null, endOfTrack: true });
  savePref(PREF_KEY, null);
  // The player loads the next song asynchronously and then calls play(), so pausing
  // as soon as `currentId` changes would be undone: wait until it is playing again.
  let pendingNext = false;
  unsubscribePlayer = usePlayer.subscribe((state, prev) => {
    if (state.currentId === null || state.mode !== prev.mode) return finish();
    if (state.currentId !== prev.currentId) pendingNext = true;
    if (pendingNext) {
      const resumed = state.isPlaying && (!prev.isPlaying || state.position > prev.position);
      if (resumed) finish();
      return;
    }
    if (!wrappedAround(state, prev)) return;
    if (state.repeat === 'one') finish();
    else if (state.repeat === 'off' && !state.isPlaying) finish();
    else pendingNext = true;
  });
}

export const useSleepTimer = create<SleepTimerState>(() => ({
  endsAt: null,
  endOfTrack: false,
  start(choice) {
    restoreVolume();
    if (choice === 'endOfTrack') {
      runEndOfTrack();
      toast(t('sleep.setEndOfTrack'));
      return;
    }
    const ms = clampMinutes(choice.minutes) * 60_000;
    runMinutes(Date.now() + ms);
    toast(t('sleep.set', { time: formatSleepTime(ms) }));
  },
  cancel() {
    restoreVolume();
    reset();
  },
}));

/** Resumes a timer saved before the app was reloaded (Android may kill it during long sleeps). */
export function restoreSleepTimer(): void {
  const saved = loadValue<{ endsAt: number } | null>(PREF_KEY, null);
  if (!saved || typeof saved.endsAt !== 'number') return;
  if (saved.endsAt > Date.now()) runMinutes(saved.endsAt);
  else savePref(PREF_KEY, null);
}

restoreSleepTimer();
