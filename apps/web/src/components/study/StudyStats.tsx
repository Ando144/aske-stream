import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { useStats } from '../../stores/stats';
import { summarizeStudy, type StudySummary } from '../../study/records';
import { getStudyRepo } from '../../study/repo';
import { ConsentSheet } from '../stats/ConsentSheet';

const HISTORY_DAYS = 90;
const DAY_MS = 86_400_000;

function useStudySummary(enabled: boolean): StudySummary | null {
  const [summary, setSummary] = useState<StudySummary | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    const now = Date.now();
    getStudyRepo()
      .listBetween(now - HISTORY_DAYS * DAY_MS, now)
      .then((records) => !stale && setSummary(summarizeStudy(records, now)))
      .catch((e) => console.error('could not load the study time', e));
    return () => {
      stale = true;
    };
  }, [enabled]);
  return summary;
}

export function StudyStats() {
  const t = useT();
  const consent = useStats((s) => s.consent);
  const [asking, setAsking] = useState(false);
  const summary = useStudySummary(consent === 'on');

  if (consent !== 'on') {
    return (
      <div className="panel study-section">
        <p className="muted">{t('study.stats.off')}</p>
        <button className="btn" onClick={() => setAsking(true)}>
          {t('study.stats.enable')}
        </button>
        {asking && (
          <ConsentSheet
            onAccept={() => {
              setAsking(false);
              void useStats.getState().setEnabled(true);
            }}
            onDecline={() => setAsking(false)}
          />
        )}
      </div>
    );
  }
  if (!summary) return null;
  const items = [
    ['study.stats.today', summary.todayMin],
    ['study.stats.week', summary.weekMin],
    ['study.stats.sessions', summary.sessions],
    ['study.stats.streak', summary.streakDays],
  ] as const;
  return (
    <div className="study-section">
      <h2>{t('study.stats.title')}</h2>
      <div className="study-stats">
        {items.map(([key, value]) => (
          <div key={key} className="panel study-stat">
            <strong>
              {key === 'study.stats.today' || key === 'study.stats.week' ? `${value} min` : value}
            </strong>
            <span className="small muted">{t(key)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
