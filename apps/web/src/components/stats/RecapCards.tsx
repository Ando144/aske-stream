import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import type { RecapSummary } from '../../stats/recap';
import { StatTrackArt } from '../art/StatTrackArt';

function Card({ label, value, quiet }: { label: string; value: string | number; quiet?: boolean }) {
  return (
    <div className={`stat-card${quiet ? ' quiet' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function TopList({
  title,
  rows,
}: {
  title: string;
  rows: {
    key: string;
    name: string;
    sub?: string;
    art?: ReactNode;
    plays: number;
    minutes: number;
  }[];
}) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <section className="panel stat-top">
      <h2 className="section-title">{title}</h2>
      <ol>
        {rows.map((row) => (
          <li key={row.key}>
            {row.art}
            <div className="grow ellipsis">
              <div className="ellipsis">{row.name}</div>
              {row.sub && <div className="faint small ellipsis">{row.sub}</div>}
            </div>
            <span className="faint small">
              {t('stats.playsCount', { count: row.plays })} ·{' '}
              {t('stats.minutesCount', { count: row.minutes })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RecapCards({ summary }: { summary: RecapSummary }) {
  const t = useT();
  const unknown = t('stats.unknownArtist');
  return (
    <>
      <div className="stat-grid">
        <Card label={t('stats.card.minutes')} value={summary.minutes} />
        <Card label={t('stats.card.plays')} value={summary.plays} />
        <Card label={t('stats.card.tracks')} value={summary.distinctTracks} />
        <Card label={t('stats.card.artists')} value={summary.distinctArtists} />
        <Card label={t('stats.card.activeDays')} value={summary.activeDays} />
        <Card
          label={t('stats.card.streak')}
          value={t('stats.days', { count: summary.longestStreakDays })}
        />
        <Card label={t('stats.card.skipped')} value={summary.skipped} quiet />
      </div>
      <TopList
        title={t('stats.card.topTracks')}
        rows={summary.topTracks.map((x) => ({
          key: `${x.title}|${x.artist}`,
          name: x.title,
          sub: x.artist || unknown,
          art: <StatTrackArt title={x.title} artist={x.artist} />,
          plays: x.plays,
          minutes: x.minutes,
        }))}
      />
      <TopList
        title={t('stats.card.topArtists')}
        rows={summary.topArtists.map((x) => ({
          key: x.artist,
          name: x.artist,
          plays: x.plays,
          minutes: x.minutes,
        }))}
      />
    </>
  );
}
