import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, ScanLine } from 'lucide-react';
import { formatJamCode } from '@aske/shared/hub';
import { useT } from '../../i18n';
import { scanQr } from '../../native/qrScanner';
import { useParcel } from '../../stores/parcel';
import { toast } from '../../stores/ui';

/** Phone: scan the QR (or type the code) of a parcel made on another screen. */
export function ReceiveSheet({
  initialCode,
  onClose,
}: {
  initialCode: string;
  onClose: () => void;
}) {
  const t = useT();
  const [code, setCode] = useState(initialCode ? formatJamCode(initialCode) : '');
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const receive = async (input: string) => {
    setBusy(true);
    const outcome = await useParcel.getState().receive(input);
    setBusy(false);
    setInvalid(outcome === 'invalid');
    if (outcome === 'ok') onClose();
  };

  const scan = async () => {
    try {
      const text = await scanQr();
      if (text) await receive(text);
    } catch {
      toast(t('jam.scannerUnavailable'), 'error');
    }
  };

  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div className="sheet dl-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <strong>{t('parcel.receiveTitle')}</strong>
        <p className="muted small">{t('parcel.receiveText')}</p>
        <button className="btn small" type="button" disabled={busy} onClick={() => void scan()}>
          <ScanLine size={16} /> {t('parcel.scan')}
        </button>
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void receive(code);
          }}
        >
          <input
            className="input jam-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('parcel.codePlaceholder')}
            aria-label={t('parcel.codePlaceholder')}
            autoCapitalize="characters"
          />
          <button className="btn primary small" type="submit" disabled={busy || !code.trim()}>
            {busy ? <LoaderCircle size={16} className="spin" /> : null}
            {busy ? t('parcel.receiving') : t('parcel.receiveButton')}
          </button>
        </form>
        {invalid && <div className="error-text small">{t('parcel.invalidCode')}</div>}
      </div>
    </div>,
    document.body,
  );
}
