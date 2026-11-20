import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n, useT } from '../../i18n';
import { currentPeriod, shiftPeriod, type RecapPeriod } from '../../stats/recap';

interface Props {
  period: RecapPeriod;
  onChange: (period: RecapPeriod) => void;
}

function periodLabel(language: string, period: RecapPeriod): string {
  if (period.kind === 'year') return String(period.year);
  const date = new Date(period.year, period.month - 1, 1);
  return new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(date);
}

function isCurrent(period: RecapPeriod): boolean {
  const now = currentPeriod(period.kind, Date.now());
  return JSON.stringify(now) === JSON.stringify(period);
}

export function PeriodPicker({ period, onChange }: Props) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const kinds = ['month', 'year'] as const;
  return (
    <div className="period-picker">
      <div className="segmented" role="radiogroup" aria-label={t('stats.title')}>
        {kinds.map((kind) => (
          <button
            key={kind}
            role="radio"
            aria-checked={period.kind === kind}
            className={period.kind === kind ? 'active' : ''}
            onClick={() => onChange(currentPeriod(kind, Date.now()))}
          >
            {t(kind === 'month' ? 'stats.period.month' : 'stats.period.year')}
          </button>
        ))}
      </div>
      <div className="row period-nav">
        <button
          className="icon-btn"
          aria-label={t('stats.period.prev')}
          onClick={() => onChange(shiftPeriod(period, -1))}
        >
          <ChevronLeft size={20} />
        </button>
        <strong className="period-name">{periodLabel(language, period)}</strong>
        <button
          className="icon-btn"
          aria-label={t('stats.period.next')}
          disabled={isCurrent(period)}
          onClick={() => onChange(shiftPeriod(period, 1))}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
