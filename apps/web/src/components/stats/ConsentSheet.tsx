import { useT } from '../../i18n';
import { Sheet } from '../Sheet';

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

/** First visit to the Recap: nothing is saved until the person says yes. */
export function ConsentSheet({ onAccept, onDecline }: Props) {
  const t = useT();
  return (
    <Sheet onClose={onDecline} label={t('stats.consent.title')}>
      <div className="sheet-body">
        <h2>{t('stats.consent.title')}</h2>
        <p className="muted">{t('stats.consent.body')}</p>
        <div className="row stats-consent-actions">
          <button className="btn primary" onClick={onAccept}>
            {t('stats.consent.accept')}
          </button>
          <button className="btn" onClick={onDecline}>
            {t('stats.consent.decline')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
