import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { formatJamCode, hubSendLink } from '@aske/shared/hub';
import { HUB_URL } from '../../config';
import { useI18n, useT } from '../../i18n';
import { useParcel, type ParcelPhase } from '../../stores/parcel';
import { QrCode } from '../QrCode';
import { Sheet } from '../Sheet';

const POLL_MS = 4000;

/** Asks the Hub whether the phone already took the parcel, only while the page is visible. */
function useParcelPolling(code: string | undefined, waiting: boolean) {
  useEffect(() => {
    if (!code || !waiting) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void useParcel.getState().poll();
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [code, waiting]);
}

function PhaseLine({ phase }: { phase: ParcelPhase }) {
  const t = useT();
  if (phase === 'received') {
    return <p style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('parcel.received')}</p>;
  }
  if (phase === 'expired') return <p className="error-text">{t('parcel.expired')}</p>;
  return (
    <p className="muted">
      <LoaderCircle size={16} className="spin" /> {t('parcel.waiting')}
    </p>
  );
}

/** Global sheet with the QR and the code of the parcel just created. */
export function ParcelSheet() {
  const t = useT();
  const language = useI18n((s) => s.language);
  const current = useParcel((s) => s.current);
  useParcelPolling(current?.code, current?.phase === 'waiting');
  if (!current) return null;

  const { dismiss, cancel } = useParcel.getState();
  const time = new Date(current.expiresAt).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return createPortal(
    <Sheet onClose={dismiss} label={t('parcel.codeTitle')}>
      <div className="sheet-header">
        <div className="grow">
          <div className="track-title">{t('parcel.codeTitle')}</div>
          <div className="faint small">{t('parcel.codeText')}</div>
        </div>
      </div>
      <div className="sheet-body">
        <div className="link-device-code">
          <QrCode text={hubSendLink(HUB_URL, current.code)} label={t('parcel.qrLabel')} />
          <div className="small muted">{t('parcel.codeLabel')}</div>
          <code style={{ fontSize: 28, letterSpacing: 3 }}>{formatJamCode(current.code)}</code>
          <div className="faint small">{t('parcel.expires', { time })}</div>
        </div>
        <PhaseLine phase={current.phase} />
        <p className="faint small">{t('parcel.privacy')}</p>
        <div className="row" style={{ gap: 8 }}>
          {current.phase === 'waiting' && (
            <button className="btn small danger" onClick={() => void cancel()}>
              {t('parcel.cancel')}
            </button>
          )}
          <button className="btn small" onClick={dismiss}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </Sheet>,
    document.body,
  );
}
