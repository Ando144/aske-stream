import { useEffect, useState } from 'react';
import {
  ChevronRight,
  CircleHelp,
  Lightbulb,
  Sparkles,
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
import { DRIVE_EMAIL_KEY, useSetup } from '../stores/setup';
import { loadValue } from '../lib/storage';
import { CopyPanel } from '../components/CopyPanel';
import { useCopy } from '../stores/copy';
import type { Destination } from '../storage/types';
import { confirmDialog, toast } from '../stores/ui';
import { useTips } from '../stores/tips';
import { LinkDevicePanel } from '../components/LinkDevicePanel';
import { AppUpdatePanel } from '../components/AppUpdatePanel';
import { ServerUpdatePanel } from '../components/ServerUpdatePanel';
import { StoragePanel } from '../components/StoragePanel';
import { AUTHOR, REPO_URL } from '../config';
import { isNative } from '../native/platform';

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

export function SettingsView() {
  const t = useT();
  const language = useI18n((s) => s.language);
  const setLanguage = useI18n((s) => s.setLanguage);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const home = useSetup((s) => s.config?.home);
  const hasCloudflare = useSetup((s) => s.savedCloudflare !== null);
  const driveEmail = loadValue<string>(DRIVE_EMAIL_KEY, '');
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
      <CopyPanel />

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
          ) : home === 'drive' ? (
            <HardDrive size={20} className="muted" />
          ) : (
            <Smartphone size={20} className="muted" />
          )}
          <div className="grow">
            <div>{t('settings.storage')}</div>
            <div className="faint small">
              {home === 'cloudflare'
                ? t('setup.cloudflare.title')
                : home === 'drive'
                  ? `${t('setup.drive.title')}${driveEmail ? ` · ${driveEmail}` : ''}`
                  : t('setup.device.title')}
            </div>
          </div>
          <button className="btn small" onClick={() => useSetup.getState().changeStorage()}>
            {t('settings.storageChange')}
          </button>
        </div>
        {home && <CopyFromOther home={home} />}
        {(home === 'drive' || driveEmail) && (
          <div className="setting">
            <button
              className="btn danger"
              onClick={async () => {
                if (
                  await confirmDialog(
                    t('settings.driveDisconnectConfirm'),
                    t('settings.driveDisconnect'),
                    true,
                  )
                ) {
                  await useSetup.getState().disconnectDrive();
                  toast(t('settings.driveDisconnected'));
                }
              }}
            >
              <LogOut size={18} /> {t('settings.driveDisconnect')}
            </button>
          </div>
        )}
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

      {home === 'cloudflare' && <LinkDevicePanel />}
      {home === 'cloudflare' && <ServerUpdatePanel />}

      <h2 className="section-title">{t('settings.app')}</h2>
      <AppUpdatePanel />

      <h2 className="section-title">{t('help.title')}</h2>
      <div className="panel">
        <Link href="/help" className="setting setting-link">
          <CircleHelp size={20} className="muted" />
          <div className="grow">
            <div>{t('settings.helpCenter')}</div>
            <div className="faint small">{t('settings.helpCenterHint')}</div>
          </div>
          <ChevronRight size={20} className="faint" />
        </Link>
        <Link href="/welcome" className="setting setting-link">
          <Sparkles size={20} className="muted" />
          <div className="grow">{t('settings.replayIntro')}</div>
          <ChevronRight size={20} className="faint" />
        </Link>
        <button
          className="setting setting-link link-btn"
          style={{ width: '100%', textAlign: 'left' }}
          onClick={() => {
            useTips.getState().resetAll();
            toast(t('settings.tipsReset'));
          }}
        >
          <Lightbulb size={20} className="muted" />
          <div className="grow">{t('settings.resetTips')}</div>
        </button>
      </div>

      <h2 className="section-title">{t('settings.about')}</h2>
      <div className="panel">
        <p style={{ marginTop: 0 }}>{t('settings.aboutText')}</p>
        <p className="about-author">
          {t('settings.madeBy')}{' '}
          <a href={AUTHOR.website} target="_blank" rel="noreferrer">
            <strong>{AUTHOR.name}</strong>
          </a>
        </p>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="row">
          <ExternalLink size={16} /> {t('settings.source')}
        </a>
        <a
          href={AUTHOR.github}
          target="_blank"
          rel="noreferrer"
          className="row"
          style={{ marginTop: 8 }}
        >
          <ExternalLink size={16} /> {t('settings.authorGithub')}
        </a>
        <p className="faint small" style={{ marginBottom: 0 }}>
          v{__APP_VERSION__} · © {new Date().getFullYear()} {AUTHOR.name} · MIT
        </p>
      </div>
    </div>
  );
}
