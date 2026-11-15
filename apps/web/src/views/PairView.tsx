import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { LANGUAGES, useI18n, useT, type Language } from '../i18n';
import { useSession } from '../stores/session';

/** Reads `#key=…` from the URL (fragment never reaches the server or its logs). */
function takeKeyFromHash(): string | null {
  const match = location.hash.match(/key=([^&]+)/);
  if (!match) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return decodeURIComponent(match[1]!);
}

export function PairView() {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      await useSession.getState().pair(value.trim());
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
      if (fromHash) void submit(fromHash);
    };
    tryHash();
    window.addEventListener('hashchange', tryHash);
    return () => window.removeEventListener('hashchange', tryHash);
  }, []);

  return (
    <div className="center-screen">
      <div className="pair-card">
        <img src="/icons/icon-192.png" alt="" />
        <h1>{t('pair.title')}</h1>
        <p className="muted">{t('pair.subtitle')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) void submit(key);
          }}
        >
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
            autoFocus
          />
          {error && <div className="error-text">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy || !key.trim()}>
            {t('pair.submit')}
          </button>
          <p className="faint small">{t('pair.help')}</p>
          <select
            className="select"
            value={language}
            aria-label="language"
            onChange={(e) => useI18n.getState().setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </form>
      </div>
    </div>
  );
}
