import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { useStudy } from '../../stores/study';
import { holdDone, holdProgress, press, release, type HoldState } from '../../study/hold';

/** Leaving early takes a 30 second press, so it cannot happen by accident. */
export function HoldToExit() {
  const t = useT();
  const [hold, setHold] = useState<HoldState>(release);
  const [progress, setProgress] = useState(0);
  const [tooSoon, setTooSoon] = useState(false);
  const holdRef = useRef(hold);
  holdRef.current = hold;

  const start = useCallback(() => {
    if (holdRef.current.pressedAt !== null) return;
    setTooSoon(false);
    setHold((h) => press(h, Date.now()));
  }, []);

  const stop = useCallback(() => {
    if (holdRef.current.pressedAt === null) return;
    setTooSoon(true);
    setHold(release());
    setProgress(0);
  }, []);

  useEffect(() => {
    if (hold.pressedAt === null) return;
    let frame = 0;
    const step = () => {
      const now = Date.now();
      setProgress(holdProgress(hold, now));
      if (holdDone(hold, now)) {
        setHold(release());
        void useStudy.getState().giveUp();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [hold]);

  const holding = hold.pressedAt !== null;
  return (
    <div className="study-hold">
      <button
        type="button"
        className="btn study-hold-btn"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start()}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && stop()}
      >
        {holding ? t('study.holdKeep') : t('study.hold')}
      </button>
      <div
        className="study-hold-bar"
        role="progressbar"
        aria-label={t('study.hold')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="study-hold-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      {tooSoon && !holding && <p className="small muted">{t('study.holdReleased')}</p>}
    </div>
  );
}
