import { useEffect, useState } from 'react';
import { Cloud, ExternalLink, Globe, HardDrive, LogOut, Smartphone } from 'lucide-react';
import { LANGUAGES, useI18n, useT, type Language } from '../i18n';
import { useSetup } from '../stores/setup';
import { confirmDialog } from '../stores/ui';

const REPO_URL = 'https://github.com/Ando144/aske-stream';

export function SettingsView() {
  const t = useT();
  const language = useI18n((s) => s.language);
  const setLanguage = useI18n((s) => s.setLanguage);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const home = useSetup((s) => s.config?.home);

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

      <h2 className="section-title">{t('settings.device')}</h2>
      <div className="panel">
        <div className="setting">
          <HardDrive size={20} className="muted" />
          <div className="grow">
            <div>{t('settings.persistent')}</div>
            <div className="faint small">
              {persisted ? t('settings.persistentOn') : t('settings.persistentOff')}
            </div>
          </div>
        </div>
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
          <button
            className="btn small"
            onClick={async () => {
              if (
                await confirmDialog(t('settings.storageChangeConfirm'), t('settings.storageChange'))
              ) {
                await useSetup.getState().reset();
              }
            }}
          >
            {t('settings.storageChange')}
          </button>
        </div>
        {home === 'cloudflare' && (
          <div className="setting">
            <button
              className="btn danger"
              onClick={async () => {
                if (await confirmDialog(t('settings.unpairConfirm'), t('settings.unpair'), true)) {
                  await useSetup.getState().reset();
                }
              }}
            >
              <LogOut size={18} /> {t('settings.unpair')}
            </button>
          </div>
        )}
      </div>

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
