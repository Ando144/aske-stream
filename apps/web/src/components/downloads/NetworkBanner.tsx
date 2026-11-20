import { WifiOff } from 'lucide-react';
import { useT } from '../../i18n';
import { useDownloads } from '../../stores/downloads';

/** Tells the user that downloads are paused for lack of signal and will resume by themselves. */
export function NetworkBanner() {
  const t = useT();
  const waiting = useDownloads((s) => s.waitingNetwork);
  if (!waiting) return null;
  return (
    <div className="banner accent" role="status">
      <WifiOff size={20} />
      <div className="grow small">{t('dl.waitingNetwork')}</div>
    </div>
  );
}
