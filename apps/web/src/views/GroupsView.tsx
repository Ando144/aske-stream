import { useEffect, useState } from 'react';
import { ChevronRight, CircleHelp, LoaderCircle, Plus, UserPlus } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { normalizeInviteCode, type GroupCardMonth, type GroupSummary } from '@aske/shared/groups';
import { CreateGroupSheet } from '../components/groups/CreateGroupSheet';
import { GroupPhoto } from '../components/groups/GroupPhoto';
import { JoinGroupSheet } from '../components/groups/JoinGroupSheet';
import { HelpSheet } from '../components/HelpSheet';
import { ScreenTip } from '../components/ScreenTip';
import { cardMoreCount, personInitials } from '../groups/look';
import { hubAvailable } from '../hub/client';
import { useI18n, useT } from '../i18n';
import { isNative } from '../native/platform';
import { useGroups } from '../stores/groups';
import '../groups.css';

export const PENDING_GROUP_KEY = 'pending-group';

const CARD_PHOTO_SIZE = 56;

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

function GroupTiles({ onOpen }: { onOpen: (dialog: Dialog) => void }) {
  const t = useT();
  return (
    <div className="groups-tiles">
      <button className="groups-tile groups-tile-primary" onClick={() => onOpen('create')}>
        <Plus size={28} aria-hidden />
        <b>{t('groups.tiles.create')}</b>
        <small>{t('groups.tiles.createHint')}</small>
      </button>
      <button className="groups-tile" onClick={() => onOpen('join')}>
        <UserPlus size={28} aria-hidden />
        <b>{t('groups.tiles.join')}</b>
        <small>{t(isNative ? 'groups.tiles.joinHintScan' : 'groups.tiles.joinHint')}</small>
      </button>
    </div>
  );
}

function PeopleStack({ people, members }: { people: string[]; members: number }) {
  const t = useT();
  const more = cardMoreCount(members, people.length);
  return (
    <span
      className="groups-stack"
      role="img"
      aria-label={t('groups.card.peopleLabel', { names: people.join(', ') })}
    >
      {people.map((alias, index) => (
        // Aliases may repeat inside a group, and the list never reorders in place.
        <span key={index} className="groups-person" title={alias} aria-hidden>
          {personInitials(alias)}
        </span>
      ))}
      {more > 0 && (
        <span className="groups-person" aria-hidden>
          {t('groups.card.more', { count: more })}
        </span>
      )}
    </span>
  );
}

function CardMonth({ month }: { month: GroupCardMonth }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  if (month.sharing <= 0 || month.minutes <= 0) {
    return (
      <div className="groups-summary">
        <span className="muted">{t('groups.card.nobody')}</span>
      </div>
    );
  }
  // A plain 1 picks the singular text; any other number is shown in the language's format.
  const count = month.minutes === 1 ? 1 : month.minutes.toLocaleString(language);
  return (
    <div className="groups-summary">
      <span className="muted">{t('groups.card.month')}</span>
      <b>{t('groups.card.minutes', { count })}</b>
      {month.topAlias && (
        <span className="groups-summary-top">{t('groups.card.top', { name: month.topAlias })}</span>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: GroupSummary }) {
  const t = useT();
  return (
    <Link href={`/groups/${group.id}`} className="groups-card">
      <div className="groups-card-line">
        <GroupPhoto
          groupId={group.id}
          name={group.name}
          photoAt={group.photoAt}
          size={CARD_PHOTO_SIZE}
        />
        <div className="grow">
          <h2 className="groups-card-name">{group.name}</h2>
          <div className="muted small">
            {t('groups.people', { count: group.members })}
            {group.isOwner && ` · ${t('groups.owner')}`}
          </div>
          {group.people && <PeopleStack people={group.people} members={group.members} />}
        </div>
        <ChevronRight size={20} className="faint" aria-hidden />
      </div>
      {group.month && <CardMonth month={group.month} />}
    </Link>
  );
}

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
  if (groups.length === 0) {
    return (
      <>
        <p className="muted">{t('groups.intro')}</p>
        <p className="muted">{t('groups.empty')}</p>
      </>
    );
  }
  return (
    <div className="groups-cards">
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} />
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
          <GroupTiles onOpen={setDialog} />
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
