import { useEffect, useState } from 'react';
import { ChevronLeft, LoaderCircle } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import type { GroupDetail } from '@aske/shared/groups';
import { GroupHero } from '../components/groups/GroupHero';
import { GroupLookSheet } from '../components/groups/GroupLookSheet';
import { GroupMembers } from '../components/groups/GroupMembers';
import { ConsentSheet } from '../components/groups/GroupsConsent';
import { GroupShares } from '../components/groups/GroupShares';
import { InviteSheet } from '../components/groups/InviteSheet';
import { MonthSummary } from '../components/groups/MonthSummary';
import { HelpButton } from '../components/HelpSheet';
import { syncGroupStats } from '../groups/sync';
import { getGroup } from '../hub/groupsClient';
import { hubErrorText } from '../hub/errors';
import { useT } from '../i18n';
import { useGroups } from '../stores/groups';
import { useStats } from '../stores/stats';
import { confirmDialog, toast } from '../stores/ui';
import '../groups.css';
import '../groupDetail.css';

function useGroup(id: string) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stale = false;
    setFailed(false);
    getGroup(id).then(
      (detail) => !stale && setGroup(detail),
      (err) => {
        console.error('Could not open the group', err);
        if (stale) return;
        toast(hubErrorText(err), 'error');
        setFailed(true);
      },
    );
    // Pushes this device's stats right away so friends see them fresh.
    void syncGroupStats({ force: true });
    return () => {
      stale = true;
    };
  }, [id]);
  return { group, setGroup, failed };
}

/**
 * After a failed save the name may already be on the Hub. Quiet on errors: the
 * sheet is already explaining what went wrong.
 */
async function refreshLook(id: string, apply: (detail: GroupDetail) => void): Promise<void> {
  try {
    const detail = await getGroup(id);
    apply(detail);
    useGroups.getState().patchSummary(id, { name: detail.name, photoAt: detail.photoAt });
  } catch (err) {
    console.error('Could not reload the group after a failed save', err);
  }
}

function SharingNotice() {
  const t = useT();
  const consent = useGroups((s) => s.consent);
  const recap = useStats((s) => s.consent);
  const [asking, setAsking] = useState(false);
  if (consent === 'off') {
    return (
      <div className="panel groups-notice">
        <p className="muted small">{t('groups.notSharing')}</p>
        <button className="btn small primary" onClick={() => setAsking(true)}>
          {t('groups.notSharing.enable')}
        </button>
        {asking && (
          <ConsentSheet
            onAccept={() => {
              setAsking(false);
              void useGroups.getState().setSharing(true);
            }}
            onDecline={() => setAsking(false)}
          />
        )}
      </div>
    );
  }
  if (recap !== 'on') return <p className="error-text small">{t('groups.recapOff')}</p>;
  return null;
}

function LeaveButton({ group, onLeft }: { group: GroupDetail; onLeft: () => void }) {
  const t = useT();
  const leave = async () => {
    if (!(await confirmDialog(t('groups.leave.confirm'), t('groups.leave.label'), true))) return;
    if (await useGroups.getState().leave(group.id, group.you)) onLeft();
  };
  return (
    <button className="btn danger group-leave" onClick={() => void leave()}>
      {t('groups.leave')}
    </button>
  );
}

function GroupContent({
  group,
  onChange,
}: {
  group: GroupDetail;
  onChange: (group: GroupDetail) => void;
}) {
  const t = useT();
  const [, navigate] = useLocation();
  const [sheet, setSheet] = useState<'invite' | 'look' | null>(null);
  const close = () => setSheet(null);
  const reload = () =>
    getGroup(group.id).then(onChange, (err) => toast(hubErrorText(err), 'error'));

  return (
    <>
      <GroupHero
        group={group}
        onInvite={() => setSheet('invite')}
        onEdit={() => setSheet('look')}
      />
      <SharingNotice />
      <MonthSummary key={group.id} group={group} />
      <GroupShares group={group} />
      <GroupMembers group={group} onChanged={() => void reload()} />
      <LeaveButton group={group} onLeft={() => navigate('/groups')} />
      {sheet === 'invite' && (
        <InviteSheet
          groupId={group.id}
          groupName={group.name}
          inviteCode={group.inviteCode}
          isOwner={group.isOwner}
          onRenewed={(inviteCode) => onChange({ ...group, inviteCode })}
          onClose={close}
        />
      )}
      {sheet === 'look' && (
        <GroupLookSheet
          group={group}
          onSaved={(name, photoAt) => onChange({ ...group, name, photoAt })}
          onFailed={() => void refreshLook(group.id, onChange)}
          onClose={close}
        />
      )}
    </>
  );
}

export function GroupView({ id }: { id: string }) {
  const t = useT();
  const { group, setGroup, failed } = useGroup(id);
  // A slow answer about a group that is no longer on screen must not replace this one.
  const update = (next: GroupDetail) => setGroup((shown) => (shown?.id === next.id ? next : shown));

  return (
    <div className="page">
      <header className="page-header group-header">
        <Link href="/groups" className="icon-btn" aria-label={t('groups.back')}>
          <ChevronLeft size={24} />
        </Link>
        <h1 className="grow">{t('groups.detail.title')}</h1>
        <div className="header-actions">
          <HelpButton id="friend-groups" label={t('groups.help')} />
        </div>
      </header>
      {failed && <p className="error-text">{t('groups.err.load')}</p>}
      {!group && !failed && (
        <p className="muted">
          <LoaderCircle size={16} className="spin" /> {t('groups.loading')}
        </p>
      )}
      {group && <GroupContent group={group} onChange={update} />}
    </div>
  );
}
