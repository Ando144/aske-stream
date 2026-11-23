import type { GroupStats } from '@aske/shared/groups';
import { useT } from '../../i18n';

interface Row {
  key: string;
  name: string;
  sub?: string;
  plays: number;
  listeners: number;
}

function RankList({ title, rows }: { title: string; rows: Row[] }) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <section className="panel stat-top">
      <h2 className="section-title">{title}</h2>
      <ol>
        {rows.map((row) => (
          <li key={row.key}>
            <div className="grow ellipsis">
              <div className="ellipsis">{row.name}</div>
              {row.sub && <div className="faint small ellipsis">{row.sub}</div>}
            </div>
            <span className="faint small groups-row-meta">
              {t('stats.playsCount', { count: row.plays })} ·{' '}
              {t('groups.ranking.listeners', { count: row.listeners })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Songs and artists of the whole group; the Hub already added everyone up. */
export function GroupRanking({ stats }: { stats: GroupStats }) {
  const t = useT();
  const { tracks, artists } = stats.ranking;
  if (tracks.length + artists.length === 0) {
    return <p className="muted">{t('groups.ranking.empty')}</p>;
  }
  const unknown = t('stats.unknownArtist');
  return (
    <>
      <RankList
        title={t('groups.ranking.tracks')}
        rows={tracks.map((x) => ({
          key: `${x.title}|${x.artist}`,
          name: x.title,
          sub: x.artist || unknown,
          plays: x.plays,
          listeners: x.listeners,
        }))}
      />
      <RankList
        title={t('groups.ranking.artists')}
        rows={artists.map((x) => ({
          key: x.artist,
          name: x.artist,
          plays: x.plays,
          listeners: x.listeners,
        }))}
      />
    </>
  );
}
