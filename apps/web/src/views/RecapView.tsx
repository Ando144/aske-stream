import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { HelpButton } from '../components/HelpSheet';
import { ConsentSheet } from '../components/stats/ConsentSheet';
import { PeriodPicker } from '../components/stats/PeriodPicker';
import { RecapCards } from '../components/stats/RecapCards';
import { currentPeriod, type RecapPeriod, type RecapSummary } from '../stats/recap';
import { useStats } from '../stores/stats';

type Loaded = { summary: RecapSummary } | { failed: true } | null;

function RecapBody({ period }: { period: RecapPeriod }) {
  const t = useT();
  const [loaded, setLoaded] = useState<Loaded>(null);

  useEffect(() => {
    let stale = false;
    setLoaded(null);
    useStats
      .getState()
      .loadRecap(period)
      .then((summary) => !stale && setLoaded({ summary }))
      .catch((err) => {
        console.error('Could not load the Recap', err);
        if (!stale) setLoaded({ failed: true });
      });
    return () => {
      stale = true;
    };
  }, [period]);

  if (!loaded) return null;
  if ('failed' in loaded) return <p className="error-text">{t('stats.err.load')}</p>;
  const { summary } = loaded;
  if (summary.plays + summary.skipped === 0) return <p className="muted">{t('stats.empty')}</p>;
  return <RecapCards summary={summary} />;
}

export function RecapView() {
  const t = useT();
  const consent = useStats((s) => s.consent);
  const [period, setPeriod] = useState<RecapPeriod>(() => currentPeriod('month', Date.now()));

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('stats.title')}</h1>
        <HelpButton id="listening-stats" label={t('stats.help')} />
      </header>
      {consent === 'unset' && (
        <ConsentSheet
          onAccept={() => void useStats.getState().setEnabled(true)}
          onDecline={() => void useStats.getState().setEnabled(false)}
        />
      )}
      {consent === 'off' && (
        <div className="panel stats-off">
          <p className="muted">{t('stats.off.text')}</p>
          <button className="btn primary" onClick={() => void useStats.getState().setEnabled(true)}>
            {t('stats.off.enable')}
          </button>
        </div>
      )}
      {consent === 'on' && (
        <>
          <PeriodPicker period={period} onChange={setPeriod} />
          <RecapBody period={period} />
        </>
      )}
    </div>
  );
}
