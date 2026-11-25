import { useEffect, useState } from 'react';
import {
  LoaderCircle,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useT } from '../../i18n';
import { formatTime } from '../../lib/format';
import { useLibrary } from '../../stores/library';
import { useCurrentTrackId, usePlayer } from '../../stores/player';
import { PODCAST_RATES } from '../../stores/podcasts';
import { toast } from '../../stores/ui';
import { ShuffleToggle } from '../ShuffleToggle';

export function PlayPauseButton({
  size = 22,
  className = 'play-fab',
}: {
  size?: number;
  className?: string;
}) {
  const t = useT();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const buffering = usePlayer((s) => s.buffering);
  const togglePlay = usePlayer((s) => s.togglePlay);
  return (
    <button
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        togglePlay();
      }}
      aria-label={isPlaying ? t('common.pause') : t('common.play')}
    >
      {buffering && isPlaying ? (
        <LoaderCircle size={size} className="spin" />
      ) : isPlaying ? (
        <Pause size={size} fill="currentColor" />
      ) : (
        <Play size={size} fill="currentColor" style={{ marginLeft: 2 }} />
      )}
    </button>
  );
}

export function TransportControls({ big = false }: { big?: boolean }) {
  const t = useT();
  const mode = usePlayer((s) => s.mode);
  const repeat = usePlayer((s) => s.repeat);
  const hasStations = usePlayer((s) => s.stationList.length > 1);
  const p = usePlayer.getState();
  const icon = big ? 26 : 20;
  const isRadio = mode === 'radio';
  const podcast = useLibrary((s) => {
    const id = usePlayer.getState().currentId;
    return mode === 'track' && !!id && s.tracks[id]?.kind === 'podcast';
  });
  usePlayer((s) => s.currentId); // re-render when the song changes
  if (podcast) return <PodcastControls big={big} />;

  const repeatLabel =
    repeat === 'one'
      ? t('player.repeatOne')
      : repeat === 'all'
        ? t('player.repeatAll')
        : t('player.repeatOff');

  const onRepeat = () => {
    p.cycleRepeat();
    const mode = usePlayer.getState().repeat;
    toast(
      t(
        mode === 'one'
          ? 'player.repeatOneHint'
          : mode === 'all'
            ? 'player.repeatAllHint'
            : 'player.repeatOffHint',
      ),
    );
  };

  return (
    <div className={`controls${big ? ' np-controls' : ''}`}>
      <ShuffleToggle size={icon - 2} disabled={isRadio} />
      <button
        className="icon-btn"
        onClick={p.previous}
        disabled={isRadio && !hasStations}
        aria-label={t('player.previous')}
      >
        <SkipBack size={icon} fill="currentColor" />
      </button>
      <PlayPauseButton size={big ? 30 : 20} />
      <button
        className="icon-btn"
        onClick={p.next}
        disabled={isRadio && !hasStations}
        aria-label={t('player.next')}
      >
        <SkipForward size={icon} fill="currentColor" />
      </button>
      <button
        className={`icon-btn${repeat !== 'off' ? ' on' : ''}`}
        onClick={onRepeat}
        disabled={isRadio}
        aria-pressed={repeat !== 'off'}
        aria-label={repeatLabel}
        title={repeatLabel}
      >
        {repeat === 'one' ? <Repeat1 size={icon - 2} /> : <Repeat size={icon - 2} />}
      </button>
    </div>
  );
}

/** Seek bar. While dragging it shows the drag position instead of the live one. */
export function SeekBar() {
  const t = useT();
  const mode = usePlayer((s) => s.mode);
  const position = usePlayer((s) => s.position);
  const liveDuration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  // Before the file is loaded (e.g. after reopening the app) use the library's duration.
  const trackId = useCurrentTrackId();
  const knownMs = useLibrary((s) => (trackId ? (s.tracks[trackId]?.durationMs ?? 0) : 0));
  const duration = liveDuration || knownMs / 1000;
  const [drag, setDrag] = useState<number | null>(null);

  useEffect(() => setDrag(null), [duration]);

  if (mode === 'radio') {
    return (
      <div className="seek" style={{ justifyContent: 'center' }}>
        <span className="live-dot" style={{ width: 'auto' }}>
          {t('player.live')}
        </span>
      </div>
    );
  }

  const value = drag ?? position;
  return (
    <div className="seek">
      <span>{formatTime(value)}</span>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.5}
        value={Math.min(value, duration || 1)}
        disabled={!duration}
        aria-label="seek"
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={() => {
          if (drag !== null) seek(drag);
          setDrag(null);
        }}
        onKeyUp={() => {
          if (drag !== null) seek(drag);
          setDrag(null);
        }}
      />
      <span>{formatTime(duration)}</span>
    </div>
  );
}

export function VolumeControl() {
  const t = useT();
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const p = usePlayer.getState();
  return (
    <div className="row">
      <button className="icon-btn" onClick={p.toggleMute} aria-label={t('player.volume')}>
        {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        aria-label={t('player.volume')}
        onChange={(e) => p.setVolume(Number(e.target.value))}
      />
    </div>
  );
}

/** Podcasts: speed, back 15 s, forward 30 s instead of shuffle/repeat. */
function PodcastControls({ big }: { big: boolean }) {
  const t = useT();
  const rate = usePlayer((s) => s.rate);
  const p = usePlayer.getState();
  const icon = big ? 26 : 20;
  const nextRate = () => {
    const i = PODCAST_RATES.indexOf(rate);
    p.setRate(PODCAST_RATES[(i + 1) % PODCAST_RATES.length] ?? 1);
  };
  return (
    <div className={`controls${big ? ' np-controls' : ''}`}>
      <button className="btn small rate-btn" onClick={nextRate} aria-label={t('podcasts.speed')}>
        {rate.toString().replace('.', ',')}×
      </button>
      <button className="icon-btn" onClick={() => p.seekBy(-15)} aria-label={t('podcasts.back')}>
        <RotateCcw size={icon} />
      </button>
      <PlayPauseButton size={big ? 30 : 20} />
      <button className="icon-btn" onClick={() => p.seekBy(30)} aria-label={t('podcasts.forward')}>
        <RotateCw size={icon} />
      </button>
      <button className="icon-btn" onClick={p.next} aria-label={t('player.next')}>
        <SkipForward size={icon} fill="currentColor" />
      </button>
    </div>
  );
}
