/** Rules for skipping the Jam's song from a phone that is not the one playing it. */
import type { JamSnapshot } from '@aske/shared/hub';
import { useJam, type JamConnection } from '../stores/jam';
import { usePlayer } from '../stores/player';

export type SkipAvailability = 'ok' | 'outdated' | 'away' | 'nothing';

export function skipAvailability(snapshot: JamSnapshot | null): SkipAvailability {
  if (!snapshot?.nowPlaying) return 'nothing';
  if (snapshot.canSkip === true) return 'ok';
  return snapshot.members.some((m) => m.isHost) ? 'outdated' : 'away';
}

/** Id of the song the host's phone has to skip now, if any. */
export function hostSkipTarget(snapshot: JamSnapshot, lastHandled: string | null): string | null {
  const requested = snapshot.skipRequested;
  if (!requested || requested !== snapshot.nowPlaying?.id) return null;
  return requested === lastHandled ? null : requested;
}

export function jamBarVisible(s: {
  role?: 'host' | 'guest';
  connection: JamConnection;
  snapshot: JamSnapshot | null;
  playerPlaying: boolean;
}): boolean {
  if (s.role !== 'guest' || s.connection !== 'open') return false;
  return Boolean(s.snapshot?.nowPlaying) && !s.playerPlaying;
}

/** True when the Jam bar takes the place of the player. */
export function useJamBarVisible(): boolean {
  const playerPlaying = usePlayer((s) => s.isPlaying);
  return useJam((s) =>
    jamBarVisible({
      role: s.session?.role,
      connection: s.connection,
      snapshot: s.snapshot,
      playerPlaying,
    }),
  );
}
