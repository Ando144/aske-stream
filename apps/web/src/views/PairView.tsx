import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ApiError } from '../api/client';
import { LanguagePicker } from '../components/LanguagePicker';
import { useT } from '../i18n';
import { useSetup } from '../stores/setup';

const GUIDE_URL = 'https://github.com/Ando144/aske-stream/blob/main/docs/deployment.md';

/** Reads `#key=…` from the URL (fragment never reaches the server or its logs). */
function takeKeyFromHash(): string | null {
  const match = location.hash.match(/key=([^&]+)/);
  if (!match) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return decodeURIComponent(match[1]!);
}

/** Connects this app to a Cloudflare instance with its access key. */
export function PairView() {
  const t = useT();
  const sameOrigin = useSetup((s) => s.sameOriginApi);
  const savedUrl = useSetup((s) => s.config?.cloudflare?.baseUrl ?? '');
  const [url, setUrl] = useState(savedUrl);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsUrl = !sameOrigin;

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const baseUrl = needsUrl ? url.trim().replace(/\/+$/, '') : '';
      await useSetup.getState().connectCloudflare(value.trim(), baseUrl);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_configured')
        setError(t('pair.notConfigured'));
      else if (err instanceof ApiError && err.status === 0) setError(t('toast.offline'));
      else setError(t('pair.invalid'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const tryHash = () => {
      const fromHash = takeKeyFromHash();
      if (fromHash && !needsUrl) void submit(fromHash);
      else if (fromHash) setKey(fromHash);
    };
    tryHash();
    window.addEventListener('hashchange', tryHash);
    return () => window.removeEventListener('hashchange', tryHash);
  }, []);

  const urlValid = !needsUrl || /^https?:\/\/\S+$/.test(url.trim());

  return (
    <div className="center-screen">
      <div className="pair-card">
        <img src="/icons/icon-192.png" alt="" />
        <h1>{t('pair.title')}</h1>
        <p className="muted">{t('pair.subtitle')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim() && urlValid) void submit(key);
          }}
        >
          {needsUrl && (
            <>
              <label htmlFor="url" className="small muted">
                {t('pair.urlLabel')}
              </label>
              <input
                id="url"
                className="input"
                inputMode="url"
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <span className="faint small">{t('pair.urlHint')}</span>
            </>
          )}
          <label htmlFor="key" className="small muted">
            {t('pair.keyLabel')}
          </label>
          <input
            id="key"
            className="input"
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoFocus={!needsUrl}
          />
          {error && <div className="error-text">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy || !key.trim() || !urlValid}>
            {t('pair.submit')}
          </button>
          <p className="faint small">{t('pair.help')}</p>
          <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="row small">
            <ExternalLink size={14} /> {t('pair.notSetUp')}
          </a>
          <button type="button" className="btn" onClick={() => void useSetup.getState().reset()}>
            <ArrowLeft size={16} /> {t('pair.back')}
          </button>
          <LanguagePicker />
        </form>
      </div>
    </div>
  );
}
