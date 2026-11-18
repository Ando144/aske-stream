import { useEffect, useState } from 'react';
import { ChevronDown, EllipsisVertical, Moon } from 'lucide-react';
import { useT } from '../../i18n';
import { usePlayer } from '../../stores/player';
import { useSleepTimer } from '../../stores/sleepTimer';
import { SleepTimerSheet } from '../SleepTimerSheet';
import { useUi } from '../../stores/ui';
import { Artwork } from './Artwork';
import { SeekBar, TransportControls, VolumeControl } from './Controls';
import { LikeButton } from './MiniPlayer';
import { QueuePanel } from './QueuePanel';
import { usePlayingInfo } from './usePlayingInfo';

export function NowPlaying() {
  const t = useT();
  const isOpen = useUi((s) => s.nowPlayingOpen);
  const info = usePlayingInfo();
  const context = usePlayer((s) => s.contextInfo);
  const sleepActive = useSleepTimer((s) => s.endsAt !== null || s.endOfTrack);
  const [sleepOpen, setSleepOpen] = useState(false);

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
          <button
            className="icon-btn"
            onClick={() => setSleepOpen(true)}
            aria-label={t('sleep.title')}
            style={sleepActive ? { color: 'var(--accent)' } : undefined}
          >
            <Moon size={22} />
          </button>
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
        {info.kind === 'track' && <QueuePanel />}
      </div>
      {sleepOpen && (
        <SleepTimerSheet
          onClose={() => setSleepOpen(false)}
          allowEndOfTrack={info.kind === 'track'}
        />
      )}
    </div>
  );
}
