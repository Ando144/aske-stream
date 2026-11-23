import type { GroupStats, MemberMonthStats } from '@aske/shared/groups';
import { useT } from '../../i18n';

function MemberCard({ member, isYou }: { member: MemberMonthStats; isYou: boolean }) {
  const t = useT();
  const unknown = t('stats.unknownArtist');
  return (
    <section className="panel groups-member-card">
      <h2 className="section-title">
        {member.alias}
        {isYou && <span className="faint small"> ({t('groups.people.you')})</span>}
      </h2>
      <p className="muted small">
        {t('stats.minutesCount', { count: member.minutes })} ·{' '}
        {t('stats.playsCount', { count: member.plays })}
      </p>
      <h3 className="small muted">{t('groups.people.tracks')}</h3>
      <ol>
        {member.topTracks.map((x) => (
          <li key={`${x.title}|${x.artist}`} className="ellipsis">
            {x.title} <span className="faint small">· {x.artist || unknown}</span>
          </li>
        ))}
      </ol>
      <h3 className="small muted">{t('groups.people.artists')}</h3>
      <ol>
        {member.topArtists.map((x) => (
          <li key={x.artist} className="ellipsis">
            {x.artist}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The top songs and artists of each person who shared that month. */
export function MemberTops({ stats, youId }: { stats: GroupStats; youId: string }) {
  const t = useT();
  if (stats.members.length === 0) return <p className="muted">{t('groups.people.empty')}</p>;
  return (
    <>
      {stats.members.map((member) => (
        <MemberCard key={member.memberId} member={member} isYou={member.memberId === youId} />
      ))}
    </>
  );
}
