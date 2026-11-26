import { useEffect, useState } from 'react';
import { LoaderCircle, Plus, SkipForward } from 'lucide-react';
import { formatJamCode, hubJamLink, type JamSnapshot } from '@aske/shared/hub';
import { HUB_URL } from '../../config';
import { skipAvailability } from '../../hub/jamRemote';
import { useT, type Translate } from '../../i18n';
import { useJam } from '../../stores/jam';
import { confirmDialog } from '../../stores/ui';
import { QrCode } from '../QrCode';
import { JamAddSheet } from './JamAddSheet';
import { JamQueue } from './JamQueue';
import '../../jamRemote.css';

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

function timeLeft(t: Translate, ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0
    ? t('jam.time.hoursMinutes', { hours, minutes })
    : t('jam.time.minutes', { minutes });
}

function RoomHeader({ snapshot, isHost }: { snapshot: JamSnapshot; isHost: boolean }) {
  const t = useT();
  const now = useNow(30_000);
  const count = snapshot.members.length;
  return (
    <section className="jam-card jam-head">
      {isHost && <QrCode text={hubJamLink(HUB_URL, snapshot.code)} label={t('jam.room.qrLabel')} />}
      <div>
        <div className="muted small">{t('jam.room.code')}</div>
        <div className="pairing-code">{formatJamCode(snapshot.code)}</div>
      </div>
      <div className="muted small">
        {count === 1 ? t('jam.room.members.one') : t('jam.room.members', { count })} ·{' '}
        {t('jam.room.expiresIn', { time: timeLeft(t, snapshot.expiresAt - now) })}
      </div>
      <p className="muted small">{isHost ? t('jam.room.hostHint') : t('jam.room.guestHint')}</p>
    </section>
  );
}

/** The host's own skip always works; guests depend on the host's phone being able to obey. */
function SkipButton({ isHost }: { isHost: boolean }) {
  const t = useT();
  const locked = useJam((s) => s.skipLocked);
  const available = useJam((s) => isHost || skipAvailability(s.snapshot) === 'ok');
  return (
    <button
      className="btn"
      onClick={() => useJam.getState().requestSkip()}
      disabled={locked || !available}
      aria-label={t('jam.skip.label')}
    >
      <SkipForward size={16} /> {t('jam.next')}
    </button>
  );
}

/** Tells a guest what skipping does, or why it is not possible right now. */
function GuestSkipNote({ snapshot }: { snapshot: JamSnapshot }) {
  const t = useT();
  const availability = skipAvailability(snapshot);
  const blocked = availability === 'outdated' || availability === 'away';
  return (
    <p className="muted small jam-skip-note">
      {blocked
        ? t(`jam.skip.${availability}`)
        : t('jam.skip.guestHint', { name: snapshot.hostName })}
    </p>
  );
}

function RoomActions({ isHost, onAdd }: { isHost: boolean; onAdd: () => void }) {
  const t = useT();
  const end = async () => {
    if (await confirmDialog(t('jam.endConfirm'), t('jam.endConfirmLabel'), true)) {
      useJam.getState().end();
    }
  };
  return (
    <div className="row wrap jam-actions">
      <button className="btn primary" onClick={onAdd}>
        <Plus size={16} /> {t('jam.add')}
      </button>
      <SkipButton isHost={isHost} />
      {isHost ? (
        <button className="btn danger" onClick={() => void end()}>
          {t('jam.end')}
        </button>
      ) : (
        <button className="btn" onClick={() => useJam.getState().leave()}>
          {t('jam.leave')}
        </button>
      )}
    </div>
  );
}

function ReplacedNotice() {
  const t = useT();
  return (
    <section className="jam-card">
      <p>{t('jam.replaced.text')}</p>
      <button className="btn primary" onClick={() => useJam.getState().takeOver()}>
        {t('jam.replaced.useHere')}
      </button>
      <button className="btn" onClick={() => useJam.getState().leave()}>
        {t('jam.leave')}
      </button>
    </section>
  );
}

function LostNotice() {
  const t = useT();
  return (
    <section className="jam-card">
      <p>{t('jam.lost.text')}</p>
      <button className="btn primary" onClick={() => useJam.getState().takeOver()}>
        {t('jam.lost.retry')}
      </button>
      <button className="btn" onClick={() => useJam.getState().leave()}>
        {t('jam.leave')}
      </button>
    </section>
  );
}

/** Inside a Jam: code and QR, now playing, the voted queue and the actions. */
export function JamRoom({ hasLibrary }: { hasLibrary: boolean }) {
  const t = useT();
  const session = useJam((s) => s.session);
  const snapshot = useJam((s) => s.snapshot);
  const connection = useJam((s) => s.connection);
  const [adding, setAdding] = useState(false);
  const isHost = session?.role === 'host';

  if (!session) return null;
  if (connection === 'replaced') return <ReplacedNotice />;
  if (connection === 'lost') return <LostNotice />;
  if (!snapshot) {
    return (
      <p className="muted">
        <LoaderCircle size={16} className="spin" /> {t('jam.connecting')}
      </p>
    );
  }
  return (
    <>
      {connection === 'reconnecting' && <p className="error-text">{t('jam.reconnecting')}</p>}
      <RoomHeader snapshot={snapshot} isHost={isHost} />
      <RoomActions isHost={isHost} onAdd={() => setAdding(true)} />
      {!isHost && <GuestSkipNote snapshot={snapshot} />}
      <JamQueue nowPlaying={snapshot.nowPlaying} queue={snapshot.queue} isHost={isHost} />
      {adding && (
        <JamAddSheet code={session.code} hasLibrary={hasLibrary} onClose={() => setAdding(false)} />
      )}
    </>
  );
}
