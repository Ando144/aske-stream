import { ArrowDownToLine, Heart, Library, ListMusic, Radio, Settings } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useT, type MessageKey } from '../i18n';
import { useLibrary } from '../stores/library';

const ITEMS: { to: string; key: MessageKey; Icon: typeof Library }[] = [
  { to: '/', key: 'nav.library', Icon: Library },
  { to: '/playlists', key: 'nav.playlists', Icon: ListMusic },
  { to: '/radio', key: 'nav.radio', Icon: Radio },
  { to: '/offline', key: 'nav.offline', Icon: ArrowDownToLine },
  { to: '/settings', key: 'nav.settings', Icon: Settings },
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
      {ITEMS.map(({ to, key, Icon }) => (
        <Link key={to} href={to} className={`side-link${isActive(location, to) ? ' active' : ''}`}>
          <Icon size={20} />
          {t(key)}
        </Link>
      ))}
      <div className="side-heading">{t('nav.playlists')}</div>
      <Link href="/liked" className={`side-playlist${location === '/liked' ? ' active' : ''}`}>
        <span className="row">
          <Heart size={14} fill="currentColor" color="#9f7cf0" /> {t('liked.title')}
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
    </aside>
  );
}
