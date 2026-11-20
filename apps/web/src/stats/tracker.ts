import { useLibrary } from '../stores/library';
import { usePlayer } from '../stores/player';
import { getStatsRepo, useStats } from '../stores/stats';
import {
  advanceSession,
  isRestart,
  startSession,
  type ListenSession,
  type PlayerSample,
} from './listen';
import type { PlayRecord } from './recap';
import type { StatsRepo } from './repo';

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  durationSec: number;
}

export interface ListenTrackerDeps {
  repo: StatsRepo;
  isEnabled(): boolean;
  /** null for podcasts or unknown tracks. */
  lookupTrack(id: string): TrackInfo | null;
  newId(): string;
}

export interface ListenTracker {
  onSample(sample: PlayerSample): void;
  /** Writes the open session if counted (the app is closing: nothing is a skip). */
  flush(): void;
}

/** While a counted listen goes on, the saved record is refreshed this often. */
const REWRITE_EVERY_SEC = 15;
/** Below this a listen is accidental (fast skipping) and is not recorded at all. */
const MIN_SKIP_SEC = 1;

interface OpenSession {
  id: string;
  info: TrackInfo;
  listen: ListenSession;
  writtenSec: number;
  wasPlaying: boolean;
}

export function createListenTracker(deps: ListenTrackerDeps): ListenTracker {
  let open: OpenSession | null = null;

  function write(s: OpenSession, skipped: boolean): void {
    const record: PlayRecord = {
      id: s.id,
      trackId: s.listen.trackId,
      title: s.info.title,
      artist: s.info.artist,
      album: s.info.album,
      startedAt: s.listen.startedAt,
      listenedSec: s.listen.listenedSec,
      durationSec: s.listen.durationSec,
      skipped,
    };
    s.writtenSec = s.listen.listenedSec;
    deps.repo.put(record).catch((err: unknown) => {
      console.warn('Could not save a listen', err);
    });
  }

  function close(): void {
    const s = open;
    open = null;
    if (!s) return;
    if (s.listen.counted) write(s, false);
    else if (s.listen.listenedSec >= MIN_SKIP_SEC) write(s, true);
  }

  function begin(sample: PlayerSample & { trackId: string }): void {
    const info = deps.lookupTrack(sample.trackId);
    if (!info) return;
    const durationSec = sample.durationSec > 0 ? sample.durationSec : info.durationSec;
    const listen = startSession({ ...sample, durationSec });
    open = { id: deps.newId(), info, listen, writtenSec: 0, wasPlaying: sample.isPlaying };
  }

  function advance(s: OpenSession, sample: PlayerSample): void {
    const { session, justCounted } = advanceSession(s.listen, sample);
    const paused = s.wasPlaying && !sample.isPlaying;
    s.listen = session;
    s.wasPlaying = sample.isPlaying;
    const dueRewrite = session.listenedSec - s.writtenSec >= REWRITE_EVERY_SEC;
    if (justCounted || (session.counted && (paused || dueRewrite))) write(s, false);
  }

  return {
    onSample(sample) {
      if (!deps.isEnabled()) {
        open = null;
        return;
      }
      if (open && (open.listen.trackId !== sample.trackId || isRestart(open.listen, sample))) {
        close();
      }
      if (open) advance(open, sample);
      else if (sample.trackId) begin({ ...sample, trackId: sample.trackId });
    },
    flush() {
      const s = open;
      if (!s || !deps.isEnabled()) return;
      if (s.listen.counted) write(s, false);
    },
  };
}

function currentSample(): PlayerSample {
  const p = usePlayer.getState();
  const countable = p.mode === 'track' && p.currentId !== null;
  return {
    trackId: countable ? p.currentId : null,
    isPlaying: p.isPlaying,
    position: p.position,
    durationSec: p.duration,
    now: Date.now(),
  };
}

function lookupTrack(id: string): TrackInfo | null {
  const track = useLibrary.getState().tracks[id];
  if (!track || track.kind === 'podcast') return null;
  const durationSec =
    track.durationMs > 0 ? track.durationMs / 1000 : usePlayer.getState().duration;
  return { title: track.title, artist: track.artist, album: track.album, durationSec };
}

/** Wires the tracker to usePlayer, useLibrary and pagehide. Returns an unsubscribe. */
export function startListeningTracker(): () => void {
  const tracker = createListenTracker({
    repo: getStatsRepo(),
    isEnabled: () => useStats.getState().consent === 'on',
    lookupTrack,
    newId: () => crypto.randomUUID(),
  });
  const feed = () => tracker.onSample(currentSample());
  const onPageHide = () => tracker.flush();
  const stopPlayer = usePlayer.subscribe(feed);
  // Turning the consent off drops the open session right away.
  const stopConsent = useStats.subscribe(feed);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    stopPlayer();
    stopConsent();
    window.removeEventListener('pagehide', onPageHide);
  };
}
