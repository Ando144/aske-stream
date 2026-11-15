import { useEffect } from 'react';
import { ChevronDown, EllipsisVertical } from 'lucide-react';
import { useT } from '../../i18n';
import { useLibrary } from '../../stores/library';
import { usePlayer } from '../../stores/player';
import { useUi } from '../../stores/ui';
import { Cover } from '../Cover';
import { Artwork } from './Artwork';
import { SeekBar, TransportControls, VolumeControl } from './Controls';
import { LikeButton } from './MiniPlayer';
import { usePlayingInfo } from './usePlayingInfo';

export function NowPlaying() {
  const t = useT();
  const isOpen = useUi((s) => s.nowPlayingOpen);
  const info = usePlayingInfo();
  const context = usePlayer((s) => s.context);

  // The Android back button should minimise the player, not leave the page:
  // opening pushes a history entry and "back" (button or gesture) pops it.
  const close = () => {
    if (history.state?.nowPlaying) history.back();
    else useUi.getState().setNowPlayingOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!history.state?.nowPlaying) history.pushState({ nowPlaying: true }, '');
    const onPop = () => useUi.getState().setNowPlayingOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  if (!isOpen || info.kind === 'none') return null;

  return (
    <div
      className="now-playing"
      role="dialog"
      aria-modal="true"
      aria-label={t('player.nowPlaying')}
    >
      <div className="np-inner">
        <div className="row">
          <button className="icon-btn" onClick={close} aria-label={t('player.minimize')}>
            <ChevronDown size={26} />
          </button>
          <div className="grow small muted ellipsis" style={{ textAlign: 'center' }}>
            {info.kind === 'radio' ? t('player.radio') : (context?.label ?? t('player.nowPlaying'))}
          </div>
          {info.kind === 'track' ? (
            <button
              className="icon-btn"
              onClick={() => useUi.getState().openTrackMenu(info.trackId!)}
              aria-label={t('common.more')}
            >
              <EllipsisVertical size={22} />
            </button>
          ) : (
            <span style={{ width: 40 }} />
          )}
        </div>

        <Artwork
          info={info}
          size={0}
          className={`np-art${info.kind === 'radio' ? ' radio' : ''}`}
        />

        <div className="row">
          <div className="grow">
            <div className="np-title ellipsis">{info.title}</div>
            <div className="muted ellipsis">{info.subtitle}</div>
          </div>
          {info.kind === 'track' && (
            <LikeButton trackId={info.trackId!} liked={info.liked} size={24} />
          )}
        </div>

        <SeekBar />
        <TransportControls big />
        <VolumeControl />
        {info.kind === 'track' && <UpNext />}
      </div>
    </div>
  );
}

function UpNext() {
  const t = useT();
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const tracks = useLibrary((s) => s.tracks);
  const upcoming = queue
    .slice(index + 1, index + 31)
    .map((id, i) => ({ id, at: index + 1 + i, track: tracks[id] }))
    .filter((x) => x.track);

  return (
    <section>
      <h2 className="section-title" style={{ marginTop: 8 }}>
        {t('player.upNext')}
      </h2>
      {upcoming.length === 0 && <p className="muted small">{t('player.queueEmpty')}</p>}
      {upcoming.map(({ id, at, track }) => (
        <button
          key={`${id}-${at}`}
          className="queue-item"
          onClick={() => usePlayer.getState().playAt(at)}
        >
          <Cover trackId={id} hasCover={track!.hasCover} size={40} />
          <div className="grow">
            <div className="track-title small">{track!.title}</div>
            <div className="muted small ellipsis">{track!.artist}</div>
          </div>
        </button>
      ))}
    </section>
  );
}
