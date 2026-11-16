import { useEffect, useState } from 'react';
import {
  ChevronRight,
  Cloud,
  ExternalLink,
  Globe,
  HardDrive,
  LogOut,
  Smartphone,
  SunMoon,
  WifiOff,
} from 'lucide-react';
import { Link } from 'wouter';
import { usePrefs } from '../stores/prefs';
import { LANGUAGES, useI18n, useT, type Language } from '../i18n';
import { useSetup } from '../stores/setup';
import { confirmDialog } from '../stores/ui';
import { AppUpdatePanel } from '../components/AppUpdatePanel';
import { StoragePanel } from '../components/StoragePanel';
import { REPO_URL } from '../config';
import { isNative } from '../native/platform';

export function SettingsView() {
  const t = useT();
  const language = useI18n((s) => s.language);
  const setLanguage = useI18n((s) => s.setLanguage);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const home = useSetup((s) => s.config?.home);
  const hasCloudflare = useSetup((s) => s.savedCloudflare !== null);
  const prefs = usePrefs();

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('settings.title')}</h1>
      </header>

      <div className="panel">
        <div className="setting">
          <Globe size={20} className="muted" />
          <label className="grow" htmlFor="lang">
            {t('settings.language')}
          </label>
          <select
            id="lang"
            className="select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h2 className="section-title">{t('settings.appearance')}</h2>
      <div className="panel">
        <div className="setting">
          <SunMoon size={20} className="muted" />
          <span className="grow">{t('settings.theme')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('settings.theme')}>
            {(['system', 'dark', 'light'] as const).map((mode) => (
              <button
                key={mode}
                role="radio"
                aria-checked={prefs.theme === mode}
                className={prefs.theme === mode ? 'active' : ''}
                onClick={() => prefs.set({ theme: mode })}
              >
                {t(
                  mode === 'system'
                    ? 'settings.themeSystem'
                    : mode === 'dark'
                      ? 'settings.themeDark'
                      : 'settings.themeLight',
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="section-title">{t('settings.playback')}</h2>
      <div className="panel">
        <Link href="/offline" className="setting setting-link">
          <WifiOff size={20} className="muted" />
          <div className="grow">
            <div>{t('settings.offline')}</div>
            <div className="faint small">{t('settings.offlineHint')}</div>
          </div>
          <ChevronRight size={20} className="faint" />
        </Link>
        <div className="setting">
          <label className="grow" htmlFor="data-saver">
            <div>{t('settings.dataSaver')}</div>
            <div className="faint small">{t('settings.dataSaverHint')}</div>
          </label>
          <span className="toggle">
            <input
              id="data-saver"
              type="checkbox"
              role="switch"
              checked={prefs.dataSaver}
              onChange={(e) => prefs.set({ dataSaver: e.target.checked })}
            />
            <span />
          </span>
        </div>
      </div>

      <h2 className="section-title">{t('storage.title')}</h2>
      <StoragePanel />

      <h2 className="section-title">{t('settings.device')}</h2>
      <div className="panel">
        {/* In the Android app files live in the app's own storage: nothing to ask for. */}
        {!isNative && (
          <div className="setting">
            <HardDrive size={20} className="muted" />
            <div className="grow">
              <div>{t('settings.persistent')}</div>
              <div className="faint small">
                {persisted ? t('settings.persistentOn') : t('settings.persistentOff')}
              </div>
            </div>
          </div>
        )}
        <div className="setting">
          {home === 'cloudflare' ? (
            <Cloud size={20} className="muted" />
          ) : (
            <Smartphone size={20} className="muted" />
          )}
          <div className="grow">
            <div>{t('settings.storage')}</div>
            <div className="faint small">
              {home === 'cloudflare' ? t('setup.cloudflare.title') : t('setup.device.title')}
            </div>
          </div>
          <button className="btn small" onClick={() => useSetup.getState().changeStorage()}>
            {t('settings.storageChange')}
          </button>
        </div>
        {(home === 'cloudflare' || hasCloudflare) && (
          <div className="setting">
            <button
              className="btn danger"
              onClick={async () => {
                if (await confirmDialog(t('settings.unpairConfirm'), t('settings.unpair'), true)) {
                  await useSetup.getState().unpair();
                }
              }}
            >
              <LogOut size={18} /> {t('settings.unpair')}
            </button>
          </div>
        )}
      </div>

      <h2 className="section-title">{t('settings.app')}</h2>
      <AppUpdatePanel />

      <h2 className="section-title">{t('settings.about')}</h2>
      <div className="panel">
        <p style={{ marginTop: 0 }}>{t('settings.aboutText')}</p>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="row">
          <ExternalLink size={16} /> {t('settings.source')}
        </a>
        <p className="faint small" style={{ marginBottom: 0 }}>
          v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
