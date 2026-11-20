import { X } from 'lucide-react';
import { Link } from 'wouter';
import { useT } from '../i18n';
import { useServerUpdate } from '../stores/serverUpdate';

/** Dismissable notice at the top: shown once per app version while the server is old. */
export function ServerUpdateBanner() {
  const t = useT();
  const outdated = useServerUpdate((s) => s.outdated);
  if (!outdated) return null;
  return (
    <div className="server-banner" role="status">
      <span className="grow small">{t('serverUpdate.banner')}</span>
      <Link href="/settings" className="btn small">
        {t('serverUpdate.bannerOpen')}
      </Link>
      <button
        className="icon-btn"
        aria-label={t('serverUpdate.dismiss')}
        onClick={() => useServerUpdate.getState().dismiss()}
      >
        <X size={18} />
      </button>
    </div>
  );
}
