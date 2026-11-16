import { useEffect } from 'react';
import { CloudUpload, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useT } from '../i18n';
import { useCopyToDrive } from '../stores/copyToDrive';
import { useSetup } from '../stores/setup';
import { HelpButton } from './HelpSheet';

/**
 * Shown while Google Drive is in use and this device still has songs from
 * when "This device" was the storage: offers to copy them to Drive.
 */
export function CopyToDrivePanel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const home = useSetup((s) => s.config?.home);
  const { pending, running, done, total, failed, finished } = useCopyToDrive();

  useEffect(() => {
    if (home === 'drive' && !running) void useCopyToDrive.getState().check();
  }, [home, running]);

  if (home !== 'drive') return null;
  if (!running && !finished && !pending) return null;
  if (compact && !running && !pending) return null;

  return (
    <div className="panel copy-drive">
      <div className="row">
        <CloudUpload size={22} className="muted" />
        <strong className="grow">{t('copyDrive.title')}</strong>
      </div>
      {running ? (
        <>
          <p className="small">{t('copyDrive.progress', { done, total })}</p>
          <div className="meter" aria-hidden>
            <div
              className="auto"
              style={{ width: `${total ? Math.max(2, (done / total) * 100) : 2}%` }}
            />
          </div>
          <p className="faint small">{t('copyDrive.keepOpen')}</p>
          <button className="btn small" onClick={() => useCopyToDrive.getState().stop()}>
            <LoaderCircle size={16} className="spin" /> {t('copyDrive.stop')}
          </button>
        </>
      ) : pending ? (
        <>
          <p className="small">{t('copyDrive.offer', { count: pending })}</p>
          <p className="faint small">{t('copyDrive.explain')}</p>
          {failed.length > 0 && (
            <div className="banner small">
              <TriangleAlert size={16} /> {t('copyDrive.someFailed', { count: failed.length })}
            </div>
          )}
          <div className="row">
            <button
              className="btn primary small"
              disabled={!navigator.onLine}
              onClick={() => void useCopyToDrive.getState().start()}
            >
              <CloudUpload size={16} /> {done > 0 ? t('copyDrive.resume') : t('copyDrive.start')}
            </button>
            <HelpButton id="drive-copy" />
          </div>
        </>
      ) : (
        <p className="small">{t('copyDrive.done')}</p>
      )}
    </div>
  );
}
