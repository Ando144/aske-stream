import { useState } from 'react';
import { PartyPopper, ScanLine, Share2, Users } from 'lucide-react';
import { Link } from 'wouter';
import { hubAvailable } from '../../hub/client';
import { useT } from '../../i18n';
import { SharePickSheet } from './SharePickSheet';

/** Entry points to everything social: share, receive, Jam and groups. */
export function FriendsRow({ onReceive }: { onReceive: () => void }) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const hub = hubAvailable();
  return (
    <section>
      <div className="faint small">{t('share.friendsTitle')}</div>
      <div className="row wrap">
        {hub && (
          <button className="btn small" onClick={() => setPicking(true)}>
            <Share2 size={16} /> {t('share.button')}
          </button>
        )}
        <button className="btn small" onClick={onReceive}>
          <ScanLine size={16} /> {t('share.receive')}
        </button>
        <Link href="/jam" className="btn small">
          <PartyPopper size={16} /> {t('nav.jam')}
        </Link>
        {hub && (
          <Link href="/groups" className="btn small">
            <Users size={16} /> {t('nav.groups')}
          </Link>
        )}
      </div>
      {picking && <SharePickSheet onClose={() => setPicking(false)} />}
    </section>
  );
}
