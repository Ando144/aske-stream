export const MIN_LISTEN_SEC = 30;
/** Forward jumps bigger than this between two samples are seeks, not listening. */
export const MAX_STEP_SEC = 3;

export interface PlayerSample {
  trackId: string | null; // null = nothing countable is playing
  isPlaying: boolean;
  position: number; // seconds
  durationSec: number; // 0 when unknown
  now: number; // epoch ms
}

export interface ListenSession {
  trackId: string;
  startedAt: number; // epoch ms of the first sample
  lastPosition: number;
  listenedSec: number; // real listened time, seeks excluded
  durationSec: number;
  counted: boolean; // threshold already reached
}

/** min(30, duration / 2); 30 when the duration is unknown. */
export function countThreshold(durationSec: number): number {
  if (!(durationSec > 0)) return MIN_LISTEN_SEC;
  return Math.min(MIN_LISTEN_SEC, durationSec / 2);
}

export function startSession(sample: PlayerSample & { trackId: string }): ListenSession {
  return {
    trackId: sample.trackId,
    startedAt: sample.now,
    lastPosition: sample.position,
    listenedSec: 0,
    durationSec: sample.durationSec,
    counted: false,
  };
}

/** Adds `position - lastPosition` only when playing and 0 < delta <= MAX_STEP_SEC. */
export function advanceSession(
  s: ListenSession,
  sample: PlayerSample,
): { session: ListenSession; justCounted: boolean } {
  const delta = sample.position - s.lastPosition;
  const listens = sample.isPlaying && delta > 0 && delta <= MAX_STEP_SEC;
  const listenedSec = listens ? s.listenedSec + delta : s.listenedSec;
  const durationSec = sample.durationSec > 0 ? sample.durationSec : s.durationSec;
  const reached = listenedSec >= countThreshold(durationSec);
  const session: ListenSession = {
    ...s,
    lastPosition: sample.position,
    listenedSec,
    durationSec,
    counted: s.counted || reached,
  };
  return { session, justCounted: !s.counted && reached };
}

/** Same track restarted from the start after reaching the end (repeat one): a new listen. */
export function isRestart(s: ListenSession, sample: PlayerSample): boolean {
  return sample.position < 2 && s.durationSec > 0 && s.lastPosition >= s.durationSec - 3;
}
