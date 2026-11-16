import { useEffect, useState } from 'react';
import { HardDrive, LoaderCircle } from 'lucide-react';
import { useT } from '../i18n';
import { getDriveToken, onDriveAuthNeeded } from '../storage/drive/auth';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { useSetup } from '../stores/setup';
import { toast } from '../stores/ui';

/**
 * In the browser, Google's permission lasts one hour and renewing it may
 * need a tap (browsers block windows nobody asked for). This bar asks for
 * that tap only when something actually needs Drive.
 */
export function DriveReconnect() {
  const t = useT();
  const home = useSetup((s) => s.config?.home);
  const [needed, setNeeded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onDriveAuthNeeded(setNeeded), []);
  if (home !== 'drive' || !needed) return null;

  return (
    <div className="banner accent drive-reconnect" role="status">
      <HardDrive size={18} />
      <span className="grow">{t('drive.reconnectText')}</span>
      <button
        className="btn primary small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await getDriveToken(true);
            setNeeded(false);
            await useLibrary.getState().load();
            useOffline.getState().scheduleRun(1000);
          } catch {
            toast(t('drive.reconnectFailed'), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <LoaderCircle size={16} className="spin" />}
        {t('drive.reconnect')}
      </button>
    </div>
  );
}
