import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, UserPlus } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import {
  GROUP_LIMITS,
  shiftMonthKey,
  type GroupDetail,
  type GroupStats,
} from '@aske/shared/groups';
import { ConsentSheet } from '../components/groups/GroupsConsent';
import { GroupMembers } from '../components/groups/GroupMembers';
import { GroupRanking } from '../components/groups/GroupRanking';
import { GroupShares } from '../components/groups/GroupShares';
import { InviteSheet } from '../components/groups/InviteSheet';
import { MemberTops } from '../components/groups/MemberTops';
import { HelpButton } from '../components/HelpSheet';
import { syncGroupStats } from '../groups/sync';
import { monthKeyOfPeriod } from '../groups/snapshot';
import { getGroup, getGroupStats } from '../hub/groupsClient';
import { hubErrorText } from '../hub/errors';
import { useI18n, useT } from '../i18n';
import { currentPeriod } from '../stats/recap';
import { useGroups } from '../stores/groups';
import { useStats } from '../stores/stats';
import { confirmDialog, toast } from '../stores/ui';
import '../groups.css';

type Tab = 'ranking' | 'people';

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
    <div className="row period-nav groups-month">
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

function StatsTabs({ group }: { group: GroupDetail }) {
  const t = useT();
  const current = monthKeyOfPeriod(currentPeriod('month', Date.now()));
  const [month, setMonth] = useState(current);
  const [tab, setTab] = useState<Tab>('ranking');
  const { stats, failed } = useMonthStats(group.id, month);
  const tabs: Tab[] = ['ranking', 'people'];
  return (
    <>
      <div className="segmented" role="radiogroup">
        {tabs.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {t(id === 'ranking' ? 'groups.tab.ranking' : 'groups.tab.people')}
          </button>
        ))}
      </div>
      <MonthPicker month={month} current={current} onChange={setMonth} />
      {failed && <p className="error-text">{t('groups.stats.err')}</p>}
      {!stats && !failed && (
        <p className="muted">
          <LoaderCircle size={16} className="spin" /> {t('groups.stats.loading')}
        </p>
      )}
      {stats && tab === 'ranking' && <GroupRanking stats={stats} />}
      {stats && tab === 'people' && <MemberTops stats={stats} youId={group.you} />}
    </>
  );
}

function LeaveButton({ group, onLeft }: { group: GroupDetail; onLeft: () => void }) {
  const t = useT();
  const leave = async () => {
    if (!(await confirmDialog(t('groups.leave.confirm'), t('groups.leave.label'), true))) return;
    if (await useGroups.getState().leave(group.id, group.you)) onLeft();
  };
  return (
    <button className="btn danger" onClick={() => void leave()}>
      {t('groups.leave')}
    </button>
  );
}

export function GroupView({ id }: { id: string }) {
  const t = useT();
  const [, navigate] = useLocation();
  const { group, setGroup, failed } = useGroup(id);
  const [inviting, setInviting] = useState(false);
  const reload = () => getGroup(id).then(setGroup, (err) => toast(hubErrorText(err), 'error'));

  return (
    <div className="page">
      <Link href="/groups" className="row small muted groups-back">
        <ChevronLeft size={18} /> {t('groups.back')}
      </Link>
      <header className="page-header">
        <h1>{group?.name ?? t('groups.title')}</h1>
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
      {group && (
        <>
          <button className="btn primary groups-invite-btn" onClick={() => setInviting(true)}>
            <UserPlus size={16} /> {t('groups.invite.button')}
          </button>
          <SharingNotice />
          <StatsTabs group={group} />
          <GroupShares group={group} />
          <GroupMembers group={group} onChanged={() => void reload()} />
          <LeaveButton group={group} onLeft={() => navigate('/groups')} />
          {inviting && (
            <InviteSheet
              groupId={group.id}
              groupName={group.name}
              inviteCode={group.inviteCode}
              isOwner={group.isOwner}
              onRenewed={(inviteCode) => setGroup({ ...group, inviteCode })}
              onClose={() => setInviting(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
