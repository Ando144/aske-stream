import { useEffect, useState } from 'react';
import { ArrowLeft, QrCode } from 'lucide-react';
import { HelpButton } from '../components/HelpSheet';
import { ApiError } from '../api/client';
import { LanguagePicker } from '../components/LanguagePicker';
import { useT, type Translate } from '../i18n';
import { useSetup } from '../stores/setup';
import { normalizeServerUrl } from '../lib/url';
import { parsePairingLink } from '@aske/shared/pairing';
import { isNative } from '../native/platform';
import { scanQr } from '../native/qrScanner';

/** Reads `#key=…` or `#code=…` from the URL (the fragment never reaches the server or its logs). */
function takeFromHash(name: 'key' | 'code'): string | null {
  const match = location.hash.match(new RegExp(`${name}=([^&]+)`));
  if (!match) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return decodeURIComponent(match[1]!);
}

type Problem = 'noInternet' | 'unreachable' | 'blocked';
type Mode = 'key' | 'code';

/**
 * The request failed before any answer arrived. Find out why, in words a
 * non-technical person can act on: no internet at all, wrong address, or a
 * server that answers but does not let the app in (usually an old version).
 */
async function diagnose(baseUrl: string): Promise<Problem> {
  const probe = (url: string) =>
    fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' }).then(
      () => true,
      () => false,
    );
  if (!(await probe('https://www.gstatic.com/generate_204'))) return 'noInternet';
  // A static file: /api answers carry a same-origin resource policy that hides them here.
  if (!(await probe(`${baseUrl}/favicon.svg`))) return 'unreachable';
  return 'blocked';
}

/** Turns a failed connection attempt into a plain-language message. */
async function explainFailure(
  err: unknown,
  mode: Mode,
  baseUrl: string,
  needsUrl: boolean,
  t: Translate,
): Promise<string> {
  if (!(err instanceof ApiError)) return t('pair.notAske');
  if (err.code === 'not_configured') return t('pair.notConfigured');
  if (err.status === 0) {
    const problem = needsUrl ? await diagnose(baseUrl) : 'noInternet';
    return t(`pair.problem.${problem}`);
  }
  if (err.status === 401) return t(mode === 'code' ? 'pairing.invalidCode' : 'pair.invalid');
  return t('pair.notAske');
}

function usePairing(url: string, setUrl: (value: string) => void, needsUrl: boolean) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string, mode: Mode = 'key', forcedBase?: string) => {
    setBusy(true);
    setError(null);
    setDetail(null);
    // A pasted sharing link carries both the address and the code.
    const link = mode === 'code' ? parsePairingLink(value.trim()) : null;
    const baseUrl =
      forcedBase ?? link?.baseUrl ?? (needsUrl ? (normalizeServerUrl(url) ?? '') : '');
    if (needsUrl) setUrl(baseUrl);
    try {
      const setup = useSetup.getState();
      if (mode === 'code') await setup.connectWithCode(link?.code ?? value, baseUrl);
      else await setup.connectCloudflare(value.trim(), baseUrl);
    } catch (err) {
      if (err instanceof ApiError) setDetail(`${err.status} ${err.code}: ${err.message}`);
      setError(await explainFailure(err, mode, baseUrl, needsUrl, t));
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    setError(null);
    setDetail(null);
    try {
      const text = await scanQr();
      if (text === null) return;
      const link = parsePairingLink(text);
      if (link) await submit(link.code, 'code', link.baseUrl);
      else setError(t('pairing.notAskeQr'));
    } catch {
      setError(t('pairing.scannerUnavailable'));
    }
  };

  return { error, detail, busy, submit, scan };
}

/** Connects this app to a Cloudflare instance with a one-time code or its access key. */
export function PairView() {
  const t = useT();
  const sameOrigin = useSetup((s) => s.sameOriginApi);
  const savedUrl = useSetup((s) => s.config?.cloudflare?.baseUrl ?? '');
  const [url, setUrl] = useState(savedUrl);
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const needsUrl = !sameOrigin;
  const { error, detail, busy, submit, scan } = usePairing(url, setUrl, needsUrl);
  useHashCredentials(needsUrl, submit, setCode, setKey);

  const urlValid = !needsUrl || normalizeServerUrl(url) !== null;
  const codeBlocked = isSubmitBlocked(busy, urlValid, code);

  return (
    <div className="center-screen">
      <div className="pair-card">
        <img src="/icons/icon-192.png" alt="" />
        <h1>{t('pair.title')}</h1>
        <p className="muted">{t('pairing.subtitleCode')}</p>
        {isNative && (
          <button className="btn primary" disabled={busy} onClick={() => void scan()}>
            <QrCode size={18} /> {t('pairing.scan')}
          </button>
        )}
        {needsUrl && <UrlField url={url} onChange={setUrl} />}
        <CodeForm
          code={code}
          onChange={setCode}
          disabled={codeBlocked}
          autoFocus={!needsUrl && !isNative}
          onSubmit={() => void submit(code, 'code')}
        />
        <PairErrors error={error} detail={detail} />
        <KeyFallback
          value={key}
          onChange={setKey}
          disabled={busy || !urlValid}
          needsUrl={needsUrl}
          onSubmit={() => void submit(key)}
        />
        <PairFooter />
      </div>
    </div>
  );
}

function PairFooter() {
  const t = useT();
  return (
    <>
      <HelpButton id="cloudflare-connect" label={t('pair.notSetUp')} />
      <HelpButton id="cant-connect" label={t('pair.problemsLink')} />
      {isNative ? (
        <button
          type="button"
          className="help-link"
          onClick={() => useSetup.getState().openCloudflareSetup()}
        >
          {t('cfsetup.pairLink')}
        </button>
      ) : (
        <p className="faint small">{t('cfsetup.pairWebOnly')}</p>
      )}
      <button type="button" className="btn" onClick={() => useSetup.getState().backToChoice()}>
        <ArrowLeft size={16} /> {t('pair.back')}
      </button>
      <LanguagePicker />
    </>
  );
}

/** A pasted sharing link carries its own address, so it does not need the address field. */
export function isSubmitBlocked(busy: boolean, urlValid: boolean, code: string): boolean {
  const codeIsLink = parsePairingLink(code.trim()) !== null;
  return busy || (!urlValid && !codeIsLink);
}

/**
 * Picks up `#code=` / `#key=` from the URL and pairs on its own when no address is needed.
 * The credential travels in the fragment so it never reaches a server or its logs, and
 * `takeFromHash` strips it from the address bar so it does not stay in the history.
 * The empty dependency list is intentional: this must run once on mount (plus on later
 * `hashchange` events); re-running when `submit` changes identity would pair twice.
 */
function useHashCredentials(
  needsUrl: boolean,
  submit: (value: string, mode?: Mode) => Promise<void>,
  setCode: (value: string) => void,
  setKey: (value: string) => void,
) {
  useEffect(() => {
    const tryHash = () => {
      const fromCode = takeFromHash('code');
      if (fromCode && !needsUrl) void submit(fromCode, 'code');
      else if (fromCode) setCode(fromCode);
      const fromHash = takeFromHash('key');
      if (fromHash && !needsUrl) void submit(fromHash);
      else if (fromHash) setKey(fromHash);
    };
    tryHash();
    window.addEventListener('hashchange', tryHash);
    return () => window.removeEventListener('hashchange', tryHash);
  }, []);
}

interface CodeFormProps {
  code: string;
  onChange: (value: string) => void;
  disabled: boolean;
  autoFocus: boolean;
  onSubmit: () => void;
}

/** Accepts the short code or a whole sharing link pasted from "Share link". */
function CodeForm({ code, onChange, disabled, autoFocus, onSubmit }: CodeFormProps) {
  const t = useT();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim() && !disabled) onSubmit();
      }}
    >
      <label htmlFor="code" className="small muted">
        {t('pairing.codeInputLabel')}
      </label>
      <input
        id="code"
        className="input"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="ABCD-2345"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
      <button className="btn primary" type="submit" disabled={disabled || !code.trim()}>
        {t('pairing.connect')}
      </button>
    </form>
  );
}

function PairErrors({ error, detail }: { error: string | null; detail: string | null }) {
  const t = useT();
  return (
    <>
      {error && <div className="error-text">{error}</div>}
      {detail && (
        <details className="faint small">
          <summary>{t('pair.details')}</summary>
          <code style={{ wordBreak: 'break-all' }}>{detail}</code>
        </details>
      )}
    </>
  );
}

interface KeyFallbackProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  needsUrl: boolean;
  onSubmit: () => void;
}

function KeyFallback({ value, onChange, disabled, needsUrl, onSubmit }: KeyFallbackProps) {
  const t = useT();
  return (
    <details className="pair-other">
      <summary className="small muted">{t('pairing.otherWays')}</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() && !disabled) onSubmit();
        }}
      >
        <label htmlFor="key" className="small muted">
          {t('pair.keyLabel')}
        </label>
        <input
          id="key"
          className="input"
          type="password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="current-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="btn" type="submit" disabled={disabled || !value.trim()}>
          {t('pair.submit')}
        </button>
        <p className="faint small">{needsUrl ? t('pair.help') : t('pair.helpKeyOnly')}</p>
      </form>
    </details>
  );
}

function UrlField({ url, onChange }: { url: string; onChange: (value: string) => void }) {
  const t = useT();
  return (
    <div className="pair-url">
      <label htmlFor="url" className="small muted">
        {t('pair.urlLabel')}
      </label>
      <input
        id="url"
        className="input"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="https://aske-stream.….workers.dev"
        value={url}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="faint small">{t('pair.urlHint')}</span>
    </div>
  );
}
