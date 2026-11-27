import type { HubSong } from '@aske/shared/hub';
import { SkipForward } from 'lucide-react';
import { useLocation } from 'wouter';
import { skipAvailability } from '../../hub/jamRemote';
import { useT } from '../../i18n';
import { useJam } from '../../stores/jam';
import { SwipeTrack } from '../gestures/SwipeTrack';
import { useSwipe } from '../gestures/useSwipe';
import { SongThumb } from '../SongThumb';
import '../../gestures.css';
import '../../jamRemote.css';

function JamCard({ song, subtitle }: { song: HubSong; subtitle: string }) {
  return (
    <>
      <SongThumb videoId={song.videoId} title={song.title} artist={song.artist} size={46} />
      <div className="grow">
        <div className="track-title small ellipsis">{song.title}</div>
        <div className="muted small ellipsis">{subtitle}</div>
      </div>
    </>
  );
}

/** Takes the player's place for a guest whose phone is silent while the Jam plays. */
export function JamBar({ variant }: { variant: 'mini' | 'desktop' }) {
  const t = useT();
  const [, navigate] = useLocation();
  const snapshot = useJam((s) => s.snapshot);
  const locked = useJam((s) => s.skipLocked);
  const canSkip = !locked && skipAvailability(snapshot) === 'ok';
  const { dx, phase, width, handlers, consumeSwipe } = useSwipe({
    onSwipe: () => {
      navigator.vibrate?.(15);
      useJam.getState().requestSkip();
    },
    allows: (direction) => direction === 'left' && canSkip,
  });
  const song = snapshot?.nowPlaying?.song;
  if (!snapshot || !song) return null;
  const subtitle = t('jam.bar.playingOn', { name: snapshot.hostName });
  const next = snapshot.queue[0]?.song;

  return (
    <div
      className={`${variant === 'mini' ? 'mini-player' : 'player-bar'} jam-bar`}
      role="group"
      aria-label={t('jam.bar.label')}
    >
      <button
        className="open-area jam-bar-open"
        onClick={() => {
          if (!consumeSwipe()) navigate('/jam');
        }}
        aria-label={t('jam.bar.open')}
        {...handlers}
      >
        <SwipeTrack
          dx={dx}
          phase={phase}
          width={width}
          neighbour={(direction) =>
            direction === 'left' && next ? <JamCard song={next} subtitle={subtitle} /> : null
          }
        >
          <JamCard song={song} subtitle={subtitle} />
        </SwipeTrack>
      </button>
      <button
        className="btn small primary jam-bar-skip"
        onClick={() => useJam.getState().requestSkip()}
        disabled={!canSkip}
        aria-label={t('jam.skip.label')}
      >
        <SkipForward size={16} /> {t('jam.next')}
      </button>
    </div>
  );
}
