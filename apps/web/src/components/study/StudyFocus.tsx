import { useEffect, useState } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { useT } from '../../i18n';
import { StudyLock } from '../../native/studyLock';
import { usePlayer } from '../../stores/player';
import { useStudy } from '../../stores/study';
import { formatClock, remainingMs, type StudySession } from '../../study/session';
import { Sheet } from '../Sheet';
import { AmbientMixer } from './AmbientMixer';
import { HoldToExit } from './HoldToExit';
import { SourcePicker } from './SourcePicker';

function useRemaining(session: StudySession): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return remainingMs(session, now);
}

function PinBanner() {
  const t = useT();
  const pin = useStudy((s) => s.pin);
  if (pin === 'pinned' || pin === 'locked') return null;
  const openSettings = () =>
    StudyLock.openPinSettings().catch((e) => console.error('could not open the settings', e));
  return (
    <div className="banner study-pin-banner" role="status">
      <p>{t('study.notPinned')}</p>
      <p className="small muted">{t('study.pinSettingsHint')}</p>
      <div className="row">
        <button className="btn primary" onClick={() => void useStudy.getState().repin()}>
          {t('study.pinAgain')}
        </button>
        <button className="btn" onClick={openSettings}>
          {t('study.pinSettings')}
        </button>
      </div>
    </div>
  );
}

function MusicControls() {
  const t = useT();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const volume = usePlayer((s) => s.volume);
  return (
    <div className="study-section">
      <div className="study-controls">
        <button
          className="icon-btn study-round"
          aria-label={isPlaying ? t('common.pause') : t('common.play')}
          onClick={() => usePlayer.getState().togglePlay()}
        >
          {isPlaying ? <Pause size={32} /> : <Play size={32} />}
        </button>
        <button
          className="icon-btn study-round"
          aria-label={t('player.next')}
          onClick={() => usePlayer.getState().next()}
        >
          <SkipForward size={32} />
        </button>
      </div>
      <label className="study-slider">
        <span>{t('study.volume')}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          aria-label={t('study.volume')}
          onChange={(e) => usePlayer.getState().setVolume(Number(e.target.value) / 100)}
        />
      </label>
    </div>
  );
}

function ChangeMusic({ session }: { session: StudySession }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        {t('study.source')}: {t('study.change')}
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} label={t('study.source')}>
          <div className="sheet-body">
            <h2>{t('study.source')}</h2>
            <SourcePicker
              value={session.source}
              onChange={(source) => {
                useStudy.getState().changeSource(source);
                setOpen(false);
              }}
            />
          </div>
        </Sheet>
      )}
    </>
  );
}

export function StudyFocus() {
  const t = useT();
  const session = useStudy((s) => s.session);
  const fellBack = useStudy((s) => s.fellBack);
  if (!session) return null;
  return <FocusScreen session={session} fellBack={fellBack} t={t} />;
}

function FocusScreen({
  session,
  fellBack,
  t,
}: {
  session: StudySession;
  fellBack: boolean;
  t: ReturnType<typeof useT>;
}) {
  const remaining = useRemaining(session);
  const clock = formatClock(remaining);
  return (
    <div className="page study-focus">
      <PinBanner />
      <div className="study-clock" role="timer" aria-label={t('study.remaining', { time: clock })}>
        {clock}
      </div>
      {fellBack && <p className="banner small">{t('study.fellBack')}</p>}
      <MusicControls />
      <ChangeMusic session={session} />
      <AmbientMixer />
      <HoldToExit />
    </div>
  );
}
