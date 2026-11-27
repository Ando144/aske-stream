import { useEffect, useState } from 'react';
import { ScanLine, Smartphone, X } from 'lucide-react';
import { api } from '../api/client';
import { SettingsLink } from '../components/SettingsLink';
import { RELEASES_URL } from '../config';
import { useT } from '../i18n';
import { formatBytes } from '../lib/format';
import { loadValue, savePref } from '../lib/storage';
import { isNative } from '../native/platform';
import { useDownloads } from '../stores/downloads';
import { useParcel } from '../stores/parcel';
import { useSetup } from '../stores/setup';
import { hubAvailable } from '../hub/client';
import { HelpButton } from '../components/HelpSheet';
import { Queue } from '../components/downloads/DownloadQueue';
import { EnginePanel } from '../components/downloads/EnginePanel';
import { SearchPanel } from '../components/downloads/SearchPanel';
import type { SendVia } from '../components/downloads/SearchResultRow';
import { Outbox } from '../components/send/Outbox';
import { ParcelPanel } from '../components/send/ParcelPanel';
import { ReceiveSheet } from '../components/send/ReceiveSheet';
import { ScreenTip } from '../components/ScreenTip';

function sendViaFor(home: string | undefined): SendVia {
  if (isNative) return null;
  if (home === 'cloudflare') return 'cloudflare';
  return hubAvailable() ? 'hub' : null;
}

/**
 * Find music on YouTube and get it into the library: download on the phone, or from a
 * computer send it to the phone (Cloudflare library) or with a code through the Hub.
 */
export function DownloadView() {
  const t = useT();
  const home = useSetup((s) => s.config?.home);
  const sendVia = sendViaFor(home);

  return (
    <div className="page">
      <header className="page-header">
        <h1>{isNative ? t('dl.title') : t('send.title')}</h1>
        <SettingsLink />
      </header>
      <Intro via={sendVia} />
      {isNative || sendVia ? (
        <>
          {isNative && hubAvailable() && (
            <>
              <ReceiveButton />
              <ScreenTip id="dl-send-2" text="parcel.tipSend" helpId="send-with-code" />
            </>
          )}
          <SearchPanel via={sendVia}>{isNative && <Queue />}</SearchPanel>
          {sendVia === 'cloudflare' && <Outbox />}
          {sendVia === 'hub' && <ParcelPanel />}
          {isNative && <WherePanel />}
          {isNative && <EnginePanel />}
        </>
      ) : (
        <div className="panel dl-explain">
          <Smartphone size={28} color="var(--accent)" />
          <p style={{ margin: 0 }}>{t('send.needsApp')}</p>
          <a className="btn small" href={RELEASES_URL} target="_blank" rel="noreferrer">
            {t('android.download')}
          </a>
        </div>
      )}
    </div>
  );
}

/** Phone: button that opens the "receive songs" sheet (also opened by a #send= link). */
function ReceiveButton() {
  const t = useT();
  const [code, setCode] = useState<string | null>(null);
  const pendingCode = useParcel((s) => s.pendingCode);

  useEffect(() => {
    if (!pendingCode) return;
    setCode(pendingCode);
    useParcel.getState().setPendingCode(null);
  }, [pendingCode]);

  return (
    <>
      <div className="row wrap">
        <button className="btn small receive-btn" onClick={() => setCode('')}>
          <ScanLine size={16} /> {t('parcel.receive')}
        </button>
      </div>
      {code !== null && <ReceiveSheet initialCode={code} onClose={() => setCode(null)} />}
    </>
  );
}

function Intro({ via }: { via: SendVia }) {
  const t = useT();
  const [open, setOpen] = useState(() => !loadValue<boolean>('dl-intro-seen', false));
  if (!open) return null;
  const close = () => {
    savePref('dl-intro-seen', true);
    setOpen(false);
  };
  const hub = via === 'hub';
  return (
    <div className="banner accent dl-intro">
      <div className="grow">
        <strong>
          {isNative ? t('dl.introTitle') : hub ? t('parcel.introTitle') : t('send.introTitle')}
        </strong>
        <p>{isNative ? t('dl.introText') : hub ? t('parcel.introText') : t('send.introText')}</p>
        <p className="small">{t('dl.legal')}</p>
        <HelpButton id={isNative ? 'download-youtube' : hub ? 'send-with-code' : 'send-to-phone'} />
      </div>
      <button className="icon-btn" aria-label={t('common.close')} onClick={close}>
        <X size={18} />
      </button>
    </div>
  );
}

/** Where downloaded songs go (and, with Cloudflare, whether to keep a copy here). */
function WherePanel() {
  const t = useT();
  const keepOffline = useDownloads((s) => s.keepOffline);
  const home = useSetup((s) => s.config?.home);
  const [used, setUsed] = useState<{ used: number; limit: number } | null>(null);
  const jobsDone = useDownloads((s) => s.jobs.filter((j) => j.status === 'done').length);
  useEffect(() => {
    if (home !== 'cloudflare') return;
    api
      .storage()
      .then((st) => setUsed({ used: st.usedBytes, limit: st.limitBytes }))
      .catch(() => undefined);
  }, [home, jobsDone]);
  return (
    <div className="panel dl-where small">
      <div>
        {home === 'cloudflare'
          ? t('dl.whereCloud')
          : home === 'drive'
            ? t('dl.whereDrive')
            : t('dl.whereDevice')}
      </div>
      {(home === 'cloudflare' || home === 'drive') && (
        <label className="row" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={keepOffline}
            onChange={(e) => useDownloads.getState().setKeepOffline(e.target.checked)}
          />
          {t('dl.keepOffline')}
        </label>
      )}
    </div>
  );
}
