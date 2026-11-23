import type { GroupDetail } from '@aske/shared/groups';
import { useT } from '../../i18n';
import { useGroups } from '../../stores/groups';
import { confirmDialog } from '../../stores/ui';

export function GroupMembers({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const t = useT();

  const kick = async (memberId: string, alias: string) => {
    const message = t('groups.members.kickConfirm', { alias });
    if (!(await confirmDialog(message, t('groups.members.kickLabel'), true))) return;
    if (await useGroups.getState().kick(group.id, memberId)) onChanged();
  };

  return (
    <section className="panel groups-section">
      <h2 className="section-title">{t('groups.members.title')}</h2>
      <ul className="groups-list">
        {group.members.map((member) => (
          <li key={member.memberId} className="row">
            <span className="grow ellipsis">
              {member.alias}
              {member.memberId === group.you && (
                <span className="faint small"> ({t('groups.people.you')})</span>
              )}
              {member.isOwner && (
                <span className="faint small"> · {t('groups.members.owner')}</span>
              )}
            </span>
            {group.isOwner && member.memberId !== group.you && (
              <button
                className="btn small danger"
                onClick={() => void kick(member.memberId, member.alias)}
              >
                {t('groups.members.kick')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
