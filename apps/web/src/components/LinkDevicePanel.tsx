import { useEffect, useState } from 'react';
import { Copy, Link2, LoaderCircle, Share2 } from 'lucide-react';
import { formatPairingCode, pairingLink } from '@aske/shared/pairing';
import { ApiError, api } from '../api/client';
import { useT } from '../i18n';
import { useSetup } from '../stores/setup';
import { toast } from '../stores/ui';
import { QrCode } from './QrCode';

interface Issued {
  code: string;
  expiresAt: number;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const seconds = String(total % 60).padStart(2, '0');
  return `${Math.floor(total / 60)}:${seconds}`;
}

/** Re-renders every second while a code is active; returns the milliseconds left. */
function useRemaining(expiresAt: number | null): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (expiresAt === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  return expiresAt === null ? 0 : Math.max(0, expiresAt - now);
}

/** Asks the server for a code; `failure` tells an expired session from a network problem. */
function useIssuedCode() {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<'unauthorized' | 'network' | null>(null);
  const create = async () => {
    setBusy(true);
    setFailure(null);
    try {
      setIssued(await api.createPairingCode());
    } catch (err) {
      setFailure(err instanceof ApiError && err.status === 401 ? 'unauthorized' : 'network');
    } finally {
      setBusy(false);
    }
  };
  return { issued, busy, failure, create };
}

function IssuedCode({ code, base, remaining }: { code: string; base: string; remaining: number }) {
  const t = useT();
  const link = pairingLink(base, code);

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ text: t('pairing.shareText'), url: link }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(link).then(
      () => toast(t('pairing.copied')),
      () => undefined,
    );
  };

  return (
    <div className="link-device-code">
      <QrCode text={link} label={t('pairing.qrLabel')} />
      <div className="small muted">{t('pairing.codeLabel')}</div>
      <div className="pairing-code">{formatPairingCode(code)}</div>
      <div className="small muted">{t('pairing.addressLabel')}</div>
      <code className="small" style={{ wordBreak: 'break-all' }}>
        {base}
      </code>
      <div className="faint small">
        {t('pairing.expiresIn', { time: formatRemaining(remaining) })}
      </div>
      <button className="btn small" onClick={() => void share()}>
        {typeof navigator.share === 'function' ? <Share2 size={16} /> : <Copy size={16} />}
        {t('pairing.share')}
      </button>
    </div>
  );
}

/** Settings → Cloudflare: shows a one-time code and QR to connect another device. */
export function LinkDevicePanel() {
  const t = useT();
  const savedBase = useSetup((s) => s.config?.cloudflare?.baseUrl ?? '');
  const base = savedBase || location.origin;
  const { issued, busy, failure, create } = useIssuedCode();
  const remaining = useRemaining(issued?.expiresAt ?? null);
  const expired = issued !== null && remaining === 0;

  return (
    <div className="panel link-device">
      <div className="setting">
        <Link2 size={20} className="muted" />
        <div className="grow">
          <div>{t('pairing.title')}</div>
          <div className="faint small">{t('pairing.intro')}</div>
        </div>
      </div>
      {issued && !expired && <IssuedCode code={issued.code} base={base} remaining={remaining} />}
      {expired && <div className="faint small">{t('pairing.expired')}</div>}
      {failure && (
        <div className="error-text">
          {t(failure === 'unauthorized' ? 'pairing.createUnauthorized' : 'pairing.createFailed')}
        </div>
      )}
      {(!issued || expired) && (
        <button className="btn small" disabled={busy} onClick={() => void create()}>
          {busy && <LoaderCircle size={16} className="spin" />}
          {issued ? t('pairing.createAnother') : t('pairing.create')}
        </button>
      )}
    </div>
  );
}
