import { Settings } from 'lucide-react';
import { Link } from 'wouter';
import { useT } from '../i18n';

/**
 * Gear in the top-right corner of every main screen on phones, where the
 * bottom bar has no room left. On wider screens the sidebar lists Settings.
 */
export function SettingsLink() {
  const t = useT();
  return (
    <Link href="/settings" className="icon-btn mobile-only" aria-label={t('common.settings')}>
      <Settings size={22} />
    </Link>
  );
}
