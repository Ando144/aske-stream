import { ChevronRight, Globe, SunMoon, WifiOff } from 'lucide-react';
import { Link } from 'wouter';
import { usePrefs } from '../../stores/prefs';
import { LANGUAGES, useI18n, useT, type Language } from '../../i18n';

const THEME_LABELS = {
  system: 'settings.themeSystem',
  dark: 'settings.themeDark',
  light: 'settings.themeLight',
} as const;

export function LanguageSection() {
  const t = useT();
  const language = useI18n((s) => s.language);
  const setLanguage = useI18n((s) => s.setLanguage);

  return (
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
  );
}

export function AppearanceSection() {
  const t = useT();
  const prefs = usePrefs();

  return (
    <>
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
                {t(THEME_LABELS[mode])}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function PlaybackSection() {
  const t = useT();
  const prefs = usePrefs();

  return (
    <>
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
    </>
  );
}
