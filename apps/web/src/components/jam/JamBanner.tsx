import { PartyPopper } from 'lucide-react';
import { formatJamCode } from '@aske/shared/hub';
import { Link, useLocation } from 'wouter';
import { useT } from '../../i18n';
import { useJam } from '../../stores/jam';

/** Reminder at the top while you are in a Jam and looking at another screen. */
export function JamBanner() {
  const t = useT();
  const [location] = useLocation();
  const code = useJam((s) => s.session?.code);
  if (!code || location === '/jam') return null;
  return (
    <div className="server-banner" role="status">
      <PartyPopper size={18} />
      <span className="grow small">{t('jam.banner', { code: formatJamCode(code) })}</span>
      <Link href="/jam" className="btn small">
        {t('jam.banner.open')}
      </Link>
    </div>
  );
}
