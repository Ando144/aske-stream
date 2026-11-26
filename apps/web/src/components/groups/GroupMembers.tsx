import type { GroupDetail, GroupMember } from '@aske/shared/groups';
import { personInitials } from '../../groups/look';
import { useT } from '../../i18n';
import { useGroups } from '../../stores/groups';
import { confirmDialog } from '../../stores/ui';

const TONES = 5;

/**
 * The Hub does not say who shares, and having no stats in a month proves nothing,
 * so "not sharing" is only known for this device.
 */
function useMemberStatus() {
  const t = useT();
  const sharingOff = useGroups((s) => s.consent === 'off');
  return (member: GroupMember, isYou: boolean): string => {
    if (member.isOwner) return t(isYou ? 'groups.member.createdYou' : 'groups.member.created');
    return t(isYou && sharingOff ? 'groups.member.notSharing' : 'groups.member.in');
  };
}

export function GroupMembers({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const t = useT();
  const statusOf = useMemberStatus();

  const kick = async (memberId: string, alias: string) => {
    const message = t('groups.members.kickConfirm', { alias });
    if (!(await confirmDialog(message, t('groups.members.kickLabel'), true))) return;
    if (await useGroups.getState().kick(group.id, memberId)) onChanged();
  };

  return (
    <section className="panel groups-section group-people">
      <h2 className="section-title">{t('groups.section.people')}</h2>
      <ul className="groups-list">
        {group.members.map((member, index) => {
          const isYou = member.memberId === group.you;
          return (
            <li key={member.memberId} className="row group-member">
              <span className={`group-person large tone-${(index % TONES) + 1}`} aria-hidden="true">
                {personInitials(member.alias)}
              </span>
              <div className="grow">
                <div className="ellipsis">
                  <strong>
                    {isYou ? t('groups.summary.you', { name: member.alias }) : member.alias}
                  </strong>
                </div>
                <div className="faint small">{statusOf(member, isYou)}</div>
              </div>
              {group.isOwner && !isYou && (
                <button
                  className="btn small danger"
                  onClick={() => void kick(member.memberId, member.alias)}
                >
                  {t('groups.members.kick')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
