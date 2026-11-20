import { useEffect, useState } from 'react';
import { Cloud, HardDrive, LogOut, Smartphone } from 'lucide-react';
import { useT } from '../../i18n';
import { DRIVE_EMAIL_KEY, useSetup } from '../../stores/setup';
import { loadValue } from '../../lib/storage';
import { useCopy } from '../../stores/copy';
import type { Destination } from '../../storage/types';
import { confirmDialog, toast } from '../../stores/ui';
import { isNative } from '../../native/platform';

/** "Copy music from another place": asks which one when there are several. */
function CopyFromOther({ home }: { home: Destination }) {
  const t = useT();
  const [choosing, setChoosing] = useState<Destination[]>([]);

  async function copyFrom(source: Destination) {
    setChoosing([]);
    await useCopy.getState().offer(source, home);
    if (useCopy.getState().job?.status !== 'offered') toast(t('copy.nothing'));
  }

  function begin() {
    const sources = useCopy.getState().availableSources();
    if (sources.length === 0) toast(t('copy.nothing'));
    else if (sources.length === 1) void copyFrom(sources[0]!);
    else setChoosing(sources);
  }

  return (
    <div className="setting">
      <div className="grow">
        <button className="btn small" onClick={begin}>
          {t('copy.fromOther')}
        </button>
        {choosing.length > 0 && (
          <div className="row">
            {choosing.map((source) => (
              <button key={source} className="btn small" onClick={() => void copyFrom(source)}>
                {t(`copy.place.${source}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PersistentStorageRow() {
  const t = useT();
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  return (
    <div className="setting">
      <HardDrive size={20} className="muted" />
      <div className="grow">
        <div>{t('settings.persistent')}</div>
        <div className="faint small">
          {persisted ? t('settings.persistentOn') : t('settings.persistentOff')}
        </div>
      </div>
    </div>
  );
}

function HomeIcon({ home }: { home: Destination | undefined }) {
  if (home === 'cloudflare') return <Cloud size={20} className="muted" />;
  if (home === 'drive') return <HardDrive size={20} className="muted" />;
  return <Smartphone size={20} className="muted" />;
}

function StorageRow({ home, driveEmail }: { home: Destination | undefined; driveEmail: string }) {
  const t = useT();
  let label = t('setup.device.title');
  if (home === 'cloudflare') label = t('setup.cloudflare.title');
  else if (home === 'drive') {
    label = `${t('setup.drive.title')}${driveEmail ? ` · ${driveEmail}` : ''}`;
  }

  return (
    <div className="setting">
      <HomeIcon home={home} />
      <div className="grow">
        <div>{t('settings.storage')}</div>
        <div className="faint small">{label}</div>
      </div>
      <button className="btn small" onClick={() => useSetup.getState().changeStorage()}>
        {t('settings.storageChange')}
      </button>
    </div>
  );
}

function DriveDisconnectRow() {
  const t = useT();

  async function disconnect() {
    const confirmed = await confirmDialog(
      t('settings.driveDisconnectConfirm'),
      t('settings.driveDisconnect'),
      true,
    );
    if (!confirmed) return;
    await useSetup.getState().disconnectDrive();
    toast(t('settings.driveDisconnected'));
  }

  return (
    <div className="setting">
      <button className="btn danger" onClick={disconnect}>
        <LogOut size={18} /> {t('settings.driveDisconnect')}
      </button>
    </div>
  );
}

function UnpairRow() {
  const t = useT();

  async function unpair() {
    if (await confirmDialog(t('settings.unpairConfirm'), t('settings.unpair'), true)) {
      await useSetup.getState().unpair();
    }
  }

  return (
    <div className="setting">
      <button className="btn danger" onClick={unpair}>
        <LogOut size={18} /> {t('settings.unpair')}
      </button>
    </div>
  );
}

export function DeviceSection() {
  const t = useT();
  const home = useSetup((s) => s.config?.home);
  const hasCloudflare = useSetup((s) => s.savedCloudflare !== null);
  const driveEmail = loadValue<string>(DRIVE_EMAIL_KEY, '');

  return (
    <>
      <h2 className="section-title">{t('settings.device')}</h2>
      <div className="panel">
        {/* In the Android app files live in the app's own storage: nothing to ask for. */}
        {!isNative && <PersistentStorageRow />}
        <StorageRow home={home} driveEmail={driveEmail} />
        {home && <CopyFromOther home={home} />}
        {(home === 'drive' || driveEmail) && <DriveDisconnectRow />}
        {(home === 'cloudflare' || hasCloudflare) && <UnpairRow />}
      </div>
    </>
  );
}
