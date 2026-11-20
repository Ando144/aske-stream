import {
  CircleHelp,
  CloudDownload,
  Heart,
  Library,
  ListMusic,
  Mic,
  PartyPopper,
  Radio,
  Settings,
  WifiOff,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useT, type MessageKey } from '../i18n';
import { useLibrary } from '../stores/library';
import { AUTHOR } from '../config';

const ITEMS: { to: string; key: MessageKey; Icon: typeof Library }[] = [
  { to: '/', key: 'nav.library', Icon: Library },
  { to: '/playlists', key: 'nav.playlists', Icon: ListMusic },
  { to: '/podcasts', key: 'nav.podcasts', Icon: Mic },
  { to: '/radio', key: 'nav.radio', Icon: Radio },
  { to: '/download', key: 'nav.download', Icon: CloudDownload },
];
/**
 * On phones "Offline" and Settings are reached from the gear on every screen
 * (Settings → Offline music); the sidebar on wide screens lists them all.
 */
const SIDEBAR_ITEMS: typeof ITEMS = [
  ...ITEMS,
  { to: '/jam', key: 'nav.jam', Icon: PartyPopper },
  { to: '/offline', key: 'nav.offline', Icon: WifiOff },
  { to: '/settings', key: 'nav.settings', Icon: Settings },
  { to: '/help', key: 'help.title', Icon: CircleHelp },
];

function isActive(location: string, to: string) {
  if (to === '/') return location === '/';
  if (to === '/playlists') return location.startsWith('/playlist') || location === '/liked';
  return location.startsWith(to);
}

export function TabBar() {
  const t = useT();
  const [location] = useLocation();
  return (
    <nav className="tabbar" aria-label="Main">
      {ITEMS.map(({ to, key, Icon }) => {
        const active = isActive(location, to);
        return (
          <Link
            key={to}
            href={to}
            className={`tab${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const t = useT();
  const [location] = useLocation();
  const playlists = useLibrary((s) => s.playlists);
  return (
    <aside className="sidebar" aria-label="Main">
      <div className="brand">
        <img src="/favicon.svg" alt="" />
        {t('app.name')}
      </div>
      {SIDEBAR_ITEMS.map(({ to, key, Icon }) => (
        <Link key={to} href={to} className={`side-link${isActive(location, to) ? ' active' : ''}`}>
          <Icon size={20} />
          {t(key)}
        </Link>
      ))}
      <div className="side-heading">{t('nav.playlists')}</div>
      <Link href="/liked" className={`side-playlist${location === '/liked' ? ' active' : ''}`}>
        <span className="row">
          <Heart size={14} fill="currentColor" color="var(--accent)" /> {t('liked.title')}
        </span>
      </Link>
      {playlists.map((pl) => (
        <Link
          key={pl.id}
          href={`/playlist/${pl.id}`}
          className={`side-playlist ellipsis${location === `/playlist/${pl.id}` ? ' active' : ''}`}
        >
          {pl.name}
        </Link>
      ))}
      <a className="side-credit" href={AUTHOR.website} target="_blank" rel="noreferrer">
        {t('settings.madeBy')} {AUTHOR.name}
      </a>
    </aside>
  );
}
