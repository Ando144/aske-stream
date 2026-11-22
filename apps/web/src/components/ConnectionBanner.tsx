import { WifiOff } from 'lucide-react';
import { useT } from '../i18n';
import { useConnectivity } from '../stores/connectivity';

/** Soft notice while there is no good connection; it retries by itself and disappears alone. */
export function ConnectionBanner() {
  const t = useT();
  const offline = useConnectivity((s) => s.status === 'offline');
  if (!offline) return null;
  return (
    <div className="connection-banner" role="status">
      <WifiOff size={18} aria-hidden="true" />
      <div className="grow">
        <div className="small">{t('common.offlineBanner')}</div>
        <div className="connection-banner-hint">{t('common.offlineBannerHint')}</div>
      </div>
    </div>
  );
}
