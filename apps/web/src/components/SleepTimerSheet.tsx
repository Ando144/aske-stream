import { useEffect, useState } from 'react';
import { Moon, TimerOff } from 'lucide-react';
import { useT, type Translate } from '../i18n';
import {
  formatSleepTime,
  SLEEP_MAX_MIN,
  SLEEP_PRESETS_MIN,
  useSleepTimer,
} from '../stores/sleepTimer';
import { Sheet } from './Sheet';

const HOURS = Array.from({ length: SLEEP_MAX_MIN / 60 + 1 }, (_, h) => h);
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5);

const presetLabel = (t: Translate, minutes: number) =>
  minutes % 60 === 0
    ? t('sleep.hours', { count: minutes / 60 })
    : minutes > 60
      ? formatSleepTime(minutes * 60_000, t)
      : t('sleep.minutes', { count: minutes });

/** Re-renders every second while a timer is running so the countdown stays current. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function CustomTime({ onPick }: { onPick: (minutes: number) => void }) {
  const t = useT();
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  // 8 h is the maximum: with 8 h, only 0 min is valid.
  const total = Math.min(SLEEP_MAX_MIN, hours * 60 + minutes);
  return (
    <div style={{ padding: '8px 14px' }}>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <strong>{t('sleep.custom')}</strong>
        <span className="faint small">{t('sleep.customHint')}</span>
      </div>
      <div className="row" style={{ gap: 10, marginTop: 8 }}>
        <select
          className="select"
          aria-label={t('sleep.hoursLabel')}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {t('sleep.hours', { count: h })}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label={t('sleep.minutesLabel')}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        >
          {MINUTE_STEPS.map((m) => (
            <option key={m} value={m}>
              {t('sleep.minutes', { count: m })}
            </option>
          ))}
        </select>
        <button className="btn primary" disabled={total === 0} onClick={() => onPick(total)}>
          {t('sleep.start')}
        </button>
      </div>
    </div>
  );
}

export function SleepTimerSheet({
  onClose,
  allowEndOfTrack,
}: {
  onClose: () => void;
  allowEndOfTrack: boolean;
}) {
  const t = useT();
  const endsAt = useSleepTimer((s) => s.endsAt);
  const endOfTrack = useSleepTimer((s) => s.endOfTrack);
  const now = useNow(endsAt !== null);
  const active = endsAt !== null || endOfTrack;
  const [changing, setChanging] = useState(false);
  const showTimes = !active || changing;

  const pick = (minutes: number) => {
    useSleepTimer.getState().start({ minutes });
    onClose();
  };

  return (
    <Sheet onClose={onClose} label={t('sleep.title')}>
      <div className="sheet-header">
        <Moon size={20} />
        <strong className="grow">{t('sleep.title')}</strong>
      </div>
      {active && (
        <div className="row" style={{ gap: 10, padding: '4px 14px', flexWrap: 'wrap' }}>
          <span className="small grow" style={{ color: 'var(--accent)' }}>
            {endsAt !== null
              ? t('sleep.remaining', { time: formatSleepTime(endsAt - now) })
              : t('sleep.setEndOfTrack')}
          </span>
          <button
            className="btn small"
            onClick={() => {
              useSleepTimer.getState().cancel();
              onClose();
            }}
          >
            <TimerOff size={16} /> {t('sleep.remove')}
          </button>
        </div>
      )}
      {active && !changing && (
        <div style={{ padding: '8px 14px' }}>
          <button
            className="link-btn"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
            onClick={() => setChanging(true)}
          >
            {t('sleep.change')}
          </button>
        </div>
      )}
      {showTimes && (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', padding: '8px 14px' }}>
            {SLEEP_PRESETS_MIN.map((m) => (
              <button key={m} className="chip" onClick={() => pick(m)}>
                {presetLabel(t, m)}
              </button>
            ))}
          </div>
          {allowEndOfTrack && (
            <button
              className="menu-item"
              onClick={() => {
                useSleepTimer.getState().start('endOfTrack');
                onClose();
              }}
            >
              <Moon size={20} /> {t('sleep.endOfTrack')}
            </button>
          )}
          <CustomTime onPick={pick} />
        </>
      )}
    </Sheet>
  );
}
