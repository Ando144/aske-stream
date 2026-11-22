import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { BOOT_CONNECTING_HINT_MS } from '../lib/boot';

/** Full-screen opening screen: shown while the app starts, never a bare spinner. */
export function BootSplash() {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), BOOT_CONNECTING_HINT_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="boot-splash" aria-label={t('boot.loading')}>
      <img className="boot-logo" src="/favicon.svg" alt="" />
      <p className="boot-hint small" aria-live="polite">
        {slow ? t('boot.connecting') : ''}
      </p>
    </div>
  );
}
