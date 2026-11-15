import { useEffect, useState } from 'react';
import {
  LoaderCircle,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useT } from '../../i18n';
import { formatTime } from '../../lib/format';
import { useLibrary } from '../../stores/library';
import { useCurrentTrackId, usePlayer } from '../../stores/player';

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
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const hasStations = usePlayer((s) => s.stationList.length > 1);
  const p = usePlayer.getState();
  const icon = big ? 26 : 20;
  const isRadio = mode === 'radio';

  const repeatLabel =
    repeat === 'one'
      ? t('player.repeatOne')
      : repeat === 'all'
        ? t('player.repeatAll')
        : t('player.repeatOff');

  return (
    <div className={`controls${big ? ' np-controls' : ''}`}>
      <button
        className={`icon-btn${shuffle ? ' on' : ''}`}
        onClick={p.toggleShuffle}
        disabled={isRadio}
        aria-label={t('player.shuffle')}
        aria-pressed={shuffle}
      >
        <Shuffle size={icon - 2} />
      </button>
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
        onClick={p.cycleRepeat}
        disabled={isRadio}
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
