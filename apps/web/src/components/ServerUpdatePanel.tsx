import { useEffect } from 'react';
import { Server } from 'lucide-react';
import { useLocation } from 'wouter';
import { HelpButton } from './HelpSheet';
import { useT } from '../i18n';
import { isNative } from '../native/platform';
import { useServerUpdate } from '../stores/serverUpdate';

/** Settings → Cloudflare: server version and, when it is old, how to update it. */
export function ServerUpdatePanel() {
  const t = useT();
  const [, navigate] = useLocation();
  const serverVersion = useServerUpdate((s) => s.serverVersion);
  // Not tied to the banner dismissal: Settings always tells the truth.
  const outdated = useServerUpdate((s) => s.behind);

  useEffect(() => {
    void useServerUpdate.getState().check();
  }, []);

  return (
    <div className="panel">
      <div className="setting">
        <Server size={20} className="muted" />
        <div className="grow">
          <div>{t('serverUpdate.title')}</div>
          <div className="faint small">
            {t('serverUpdate.versions', {
              server: serverVersion || t('serverUpdate.unknownVersion'),
              app: __APP_VERSION__,
            })}
          </div>
          <div className="faint small">
            {t(outdated ? 'serverUpdate.outdated' : 'serverUpdate.upToDate')}
          </div>
        </div>
        {outdated && isNative && (
          <button className="btn small primary" onClick={() => navigate('/server-update')}>
            {t('serverUpdate.button')}
          </button>
        )}
      </div>
      {outdated && !isNative && <p className="faint small">{t('serverUpdate.webOnly')}</p>}
      {outdated && <HelpButton id="cloudflare-update" />}
    </div>
  );
}
