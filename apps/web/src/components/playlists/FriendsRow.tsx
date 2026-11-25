import { PartyPopper, ScanLine, Users } from 'lucide-react';
import { Link } from 'wouter';
import { hubAvailable } from '../../hub/client';
import { useT } from '../../i18n';

/** Entry points to everything social: receive, Jam and groups. */
export function FriendsRow({ onReceive }: { onReceive: () => void }) {
  const t = useT();
  return (
    <section>
      <div className="faint small">{t('share.friendsTitle')}</div>
      <div className="row wrap">
        <button className="btn small" onClick={onReceive}>
          <ScanLine size={16} /> {t('share.receive')}
        </button>
        <Link href="/jam" className="btn small">
          <PartyPopper size={16} /> {t('nav.jam')}
        </Link>
        {hubAvailable() && (
          <Link href="/groups" className="btn small">
            <Users size={16} /> {t('nav.groups')}
          </Link>
        )}
      </div>
    </section>
  );
}
