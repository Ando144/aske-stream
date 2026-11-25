import { useEffect, useState } from 'react';
import { ChevronRight, CircleHelp, LoaderCircle, Plus, UserPlus, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { normalizeInviteCode } from '@aske/shared/groups';
import { CreateGroupSheet } from '../components/groups/CreateGroupSheet';
import { JoinGroupSheet } from '../components/groups/JoinGroupSheet';
import { HelpSheet } from '../components/HelpSheet';
import { ScreenTip } from '../components/ScreenTip';
import { hubAvailable } from '../hub/client';
import { useT } from '../i18n';
import { useGroups } from '../stores/groups';
import '../groups.css';

export const PENDING_GROUP_KEY = 'pending-group';

/** A group link opens the app as `/#group=CODE`; keep the code for the Groups screen. */
export function takePendingGroupCode(): string | null {
  const code = new URLSearchParams(location.hash.replace(/^#/, '')).get('group');
  const clean = code === null ? null : normalizeInviteCode(code);
  if (clean) {
    sessionStorage.setItem(PENDING_GROUP_KEY, clean);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return sessionStorage.getItem(PENDING_GROUP_KEY);
}

type Dialog = 'create' | 'join' | null;

function GroupList({ loaded }: { loaded: boolean }) {
  const t = useT();
  const groups = useGroups((s) => s.groups);
  if (!loaded) {
    return (
      <p className="muted">
        <LoaderCircle size={16} className="spin" /> {t('groups.loading')}
      </p>
    );
  }
  if (groups.length === 0) return <p className="muted">{t('groups.empty')}</p>;
  return (
    <div className="card-list">
      {groups.map((group) => (
        <Link key={group.id} href={`/groups/${group.id}`} className="card-row">
          <span className="groups-icon">
            <Users size={22} />
          </span>
          <div className="grow groups-card-text">
            <div className="card-title ellipsis">{group.name}</div>
            <div className="muted small">
              {t('groups.people', { count: group.members })}
              {group.isOwner && ` · ${t('groups.owner')}`}
            </div>
          </div>
          <ChevronRight size={20} className="faint" />
        </Link>
      ))}
    </div>
  );
}

export function GroupsView() {
  const t = useT();
  const [, navigate] = useLocation();
  const [loaded, setLoaded] = useState(false);
  const [pendingCode] = useState(() => sessionStorage.getItem(PENDING_GROUP_KEY) ?? '');
  const [dialog, setDialog] = useState<Dialog>(pendingCode ? 'join' : null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem(PENDING_GROUP_KEY);
    void useGroups
      .getState()
      .refresh()
      .finally(() => setLoaded(true));
  }, []);

  const enter = (groupId: string) => {
    setDialog(null);
    navigate(`/groups/${groupId}`);
  };

  return (
    <div className="page">
      <header className="page-header groups-header">
        <h1>{t('groups.title')}</h1>
        <div className="header-actions">
          <button
            className="icon-btn"
            aria-label={t('groups.help')}
            title={t('groups.help')}
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp size={20} />
          </button>
        </div>
      </header>
      {helpOpen && <HelpSheet id="friend-groups" onClose={() => setHelpOpen(false)} />}
      <ScreenTip id="groups" text="groups.tip" helpId="friend-groups" />
      {!hubAvailable() ? (
        <p className="error-text">{t('hub.err.unavailable')}</p>
      ) : (
        <>
          <p className="muted">{t('groups.intro')}</p>
          <div className="row groups-actions">
            <button className="btn primary" onClick={() => setDialog('create')}>
              <Plus size={16} /> {t('groups.create.button')}
            </button>
            <button className="btn" onClick={() => setDialog('join')}>
              <UserPlus size={16} /> {t('groups.join.button')}
            </button>
          </div>
          <GroupList loaded={loaded} />
          <p className="faint small groups-settings-note">
            {t('groups.settingsNote')} <Link href="/settings">{t('groups.settingsLink')}</Link>
          </p>
        </>
      )}
      {dialog === 'create' && (
        <CreateGroupSheet onClose={() => setDialog(null)} onCreated={enter} />
      )}
      {dialog === 'join' && (
        <JoinGroupSheet
          initialCode={pendingCode}
          onClose={() => setDialog(null)}
          onJoined={enter}
        />
      )}
    </div>
  );
}
