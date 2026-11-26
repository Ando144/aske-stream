import { Pencil, UserPlus } from 'lucide-react';
import type { GroupDetail, GroupMember } from '@aske/shared/groups';
import { cardMoreCount, personInitials } from '../../groups/look';
import { useT } from '../../i18n';
import { GroupPhoto } from './GroupPhoto';

const PHOTO_SIZE = 96;
const MAX_PEOPLE = 5;

function PeopleStack({ members }: { members: GroupMember[] }) {
  const t = useT();
  const shown = members.slice(0, MAX_PEOPLE);
  const more = cardMoreCount(members.length, shown.length);
  const names = members.map((m) => m.alias).join(', ');
  return (
    <div className="group-stack" role="img" aria-label={t('groups.card.peopleLabel', { names })}>
      {shown.map((member, index) => (
        <span
          key={member.memberId}
          className={`group-person tone-${index + 1}`}
          title={member.alias}
        >
          {personInitials(member.alias)}
        </span>
      ))}
      {more > 0 && <span className="group-person">{t('groups.card.more', { count: more })}</span>}
    </div>
  );
}

export function GroupHero({
  group,
  onInvite,
  onEdit,
}: {
  group: GroupDetail;
  onInvite: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  return (
    <section className="group-hero">
      <GroupPhoto name={group.name} photoAt={group.photoAt} groupId={group.id} size={PHOTO_SIZE} />
      <h2>{group.name}</h2>
      <PeopleStack members={group.members} />
      <div className="group-pair">
        <button className="btn primary" onClick={onInvite}>
          <UserPlus size={18} /> {t('groups.invite.button')}
        </button>
        <button className="btn" onClick={onEdit}>
          <Pencil size={18} /> {t('groups.look.button')}
        </button>
      </div>
    </section>
  );
}
