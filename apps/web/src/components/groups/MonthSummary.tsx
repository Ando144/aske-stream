import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import {
  GROUP_LIMITS,
  shiftMonthKey,
  type GroupDetail,
  type GroupStats,
} from '@aske/shared/groups';
import { personInitials } from '../../groups/look';
import { monthKeyOfPeriod } from '../../groups/snapshot';
import { monthSummary, type MonthSummaryData } from '../../groups/summary';
import { getGroupStats } from '../../hub/groupsClient';
import { useI18n, useT } from '../../i18n';
import { currentPeriod } from '../../stats/recap';
import { StatTrackArt } from '../art/StatTrackArt';
import { Sheet } from '../Sheet';
import { GroupRanking } from './GroupRanking';
import { MemberTops } from './MemberTops';

type Detail = 'ranking' | 'people';

function useMonthStats(groupId: string, month: string) {
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stale = false;
    setStats(null);
    setFailed(false);
    getGroupStats(groupId, month).then(
      (loaded) => !stale && setStats(loaded),
      (err) => {
        console.error('Could not load the group stats', err);
        if (!stale) setFailed(true);
      },
    );
    return () => {
      stale = true;
    };
  }, [groupId, month]);
  return { stats, failed };
}

function MonthPicker({
  month,
  current,
  onChange,
}: Record<'month' | 'current', string> & {
  onChange: (month: string) => void;
}) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const oldest = shiftMonthKey(current, -(GROUP_LIMITS.statsKeepMonths - 1));
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const label = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(
    new Date(year, mon - 1, 1),
  );
  return (
    <div className="row period-nav group-month">
      <button
        className="icon-btn"
        aria-label={t('groups.month.prev')}
        disabled={month <= oldest}
        onClick={() => onChange(shiftMonthKey(month, -1))}
      >
        <ChevronLeft size={20} />
      </button>
      <strong className="period-name">{label}</strong>
      <button
        className="icon-btn"
        aria-label={t('groups.month.next')}
        disabled={month >= current}
        onClick={() => onChange(shiftMonthKey(month, 1))}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function Figures({ summary }: { summary: MonthSummaryData }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  return (
    <div className="group-figures">
      <p>
        <b>{summary.minutes.toLocaleString(language)}</b>
        <span>{t('groups.summary.minutes')}</span>
      </p>
      <p>
        <b>{t('groups.summary.sharing', { count: summary.sharing, total: summary.total })}</b>
        <span>{t('groups.summary.sharingLabel')}</span>
      </p>
    </div>
  );
}

/** Listed first to third for screen readers; the CSS puts the winner in the middle. */
function Podium({ places }: { places: MonthSummaryData['podium'] }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  if (places.length === 0) return null;
  return (
    <ol className="group-podium">
      {places.map((person, index) => (
        <li key={index} className={`place-${person.place}`}>
          <span className={`group-person tone-${index + 1}`} aria-hidden="true">
            {personInitials(person.alias)}
          </span>
          <b className="ellipsis">
            {person.isYou ? t('groups.summary.you', { name: person.alias }) : person.alias}
          </b>
          <span className="small muted">
            {t('groups.summary.min', { count: person.minutes.toLocaleString(language) })}
          </span>
          <span className="group-podium-block">
            {t('groups.summary.place', { n: person.place })}
          </span>
        </li>
      ))}
    </ol>
  );
}

function TopSongs({ tracks }: { tracks: MonthSummaryData['topTracks'] }) {
  const t = useT();
  if (tracks.length === 0) return null;
  return (
    <>
      <h3 className="group-songs-title">{t('groups.summary.songs')}</h3>
      <ol className="group-songs">
        {tracks.map((track, index) => (
          <li key={`${track.title}|${track.artist}`} className="row">
            <span className="group-song-number" aria-hidden="true">
              {index + 1}
            </span>
            <StatTrackArt title={track.title} artist={track.artist} />
            <div className="grow">
              <div className="ellipsis">
                <strong>{track.title}</strong>
              </div>
              <div className="faint small ellipsis">
                {track.artist || t('stats.unknownArtist')} ·{' '}
                {t('groups.summary.times', { count: track.plays })}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function SummaryBody({ stats, group }: { stats: GroupStats; group: GroupDetail }) {
  const t = useT();
  const [detail, setDetail] = useState<Detail | null>(null);
  const summary = monthSummary(stats, group.members.length, group.you);
  if (summary.sharing === 0) return <p className="muted">{t('groups.summary.empty')}</p>;
  const title = t(detail === 'people' ? 'groups.tab.people' : 'groups.tab.ranking');
  return (
    <>
      <Figures summary={summary} />
      <Podium places={summary.podium} />
      <TopSongs tracks={summary.topTracks} />
      <div className="group-pair">
        <button className="btn" onClick={() => setDetail('ranking')}>
          {t('groups.summary.fullRanking')}
        </button>
        <button className="btn" onClick={() => setDetail('people')}>
          {t('groups.summary.eachPerson')}
        </button>
      </div>
      {detail && (
        <Sheet onClose={() => setDetail(null)} label={title}>
          <div className="sheet-body group-detail-sheet">
            <h2>{title}</h2>
            {detail === 'ranking' ? (
              <GroupRanking stats={stats} />
            ) : (
              <MemberTops stats={stats} youId={group.you} />
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}

export function MonthSummary({ group }: { group: GroupDetail }) {
  const t = useT();
  const current = monthKeyOfPeriod(currentPeriod('month', Date.now()));
  const [month, setMonth] = useState(current);
  const { stats, failed } = useMonthStats(group.id, month);
  return (
    <section className="panel groups-section group-summary">
      <h2 className="section-title">{t('groups.summary.title')}</h2>
      <MonthPicker month={month} current={current} onChange={setMonth} />
      {failed && <p className="error-text">{t('groups.stats.err')}</p>}
      {!stats && !failed && (
        <p className="muted">
          <LoaderCircle size={16} className="spin" /> {t('groups.stats.loading')}
        </p>
      )}
      {stats && <SummaryBody stats={stats} group={group} />}
    </section>
  );
}
