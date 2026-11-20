import { useEffect, useState } from 'react';
import { BatteryWarning } from 'lucide-react';
import { useT } from '../../i18n';
import { AskeNative } from '../../native/askeNative';

/**
 * Android may pause apps in the background to save battery. Downloads with
 * the screen off need the app to be exempt: ask, explained in plain words.
 * Also tells the user that closing the app is fine.
 */
export function BatteryHint() {
  const t = useT();
  const [restricted, setRestricted] = useState(false);
  useEffect(() => {
    const check = () =>
      void AskeNative.batteryStatus()
        .then((s) => setRestricted(!s.unrestricted))
        .catch(() => setRestricted(false));
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return (
    <>
      <p className="muted small">{t('dl.closeOk')}</p>
      {restricted && (
        <div className="banner dl-battery">
          <BatteryWarning size={20} />
          <div className="grow small">{t('dl.batteryText')}</div>
          <button
            className="btn small primary"
            onClick={() => void AskeNative.requestBatteryExemption()}
          >
            {t('dl.batteryButton')}
          </button>
        </div>
      )}
    </>
  );
}
