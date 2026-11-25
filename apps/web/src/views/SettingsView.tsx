import { useT } from '../i18n';
import { useSetup } from '../stores/setup';
import { CopyPanel } from '../components/CopyPanel';
import { LinkDevicePanel } from '../components/LinkDevicePanel';
import { AppUpdatePanel } from '../components/AppUpdatePanel';
import { ServerUpdatePanel } from '../components/ServerUpdatePanel';
import { StoragePanel } from '../components/StoragePanel';
import { StatsSettingsPanel } from '../components/stats/StatsSettingsPanel';
import {
  AppearanceSection,
  LanguageSection,
  PlaybackSection,
} from '../components/settings/GeneralSections';
import { GroupsSection } from '../components/settings/GroupsSection';
import { DeviceSection } from '../components/settings/DeviceSection';
import { AboutSection, HelpSection } from '../components/settings/HelpAboutSections';

export function SettingsView() {
  const t = useT();
  const home = useSetup((s) => s.config?.home);

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('settings.title')}</h1>
      </header>

      <LanguageSection />
      <AppearanceSection />
      <PlaybackSection />

      <h2 className="section-title">{t('stats.settings.section')}</h2>
      <StatsSettingsPanel />

      <GroupsSection />

      <h2 className="section-title">{t('storage.title')}</h2>
      <StoragePanel />
      <CopyPanel />

      <DeviceSection />

      {home === 'cloudflare' && <LinkDevicePanel />}
      {home === 'cloudflare' && <ServerUpdatePanel />}

      <h2 className="section-title">{t('settings.app')}</h2>
      <AppUpdatePanel />

      <HelpSection />
      <AboutSection />
    </div>
  );
}
