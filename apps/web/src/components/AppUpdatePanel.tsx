import {
  Download,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { RELEASES_URL } from '../config';
import { useT } from '../i18n';
import { formatBytes } from '../lib/format';
import { isNative } from '../native/platform';
import { useUpdater } from '../stores/updater';

/**
 * Settings → App. In the Android app: version and in-app updates, explained
 * step by step. In a browser: where to get the Android app.
 */
export function AppUpdatePanel() {
  const t = useT();
  const u = useUpdater();

  if (!isNative) {
    return (
      <div className="panel">
        <div className="setting">
          <Smartphone size={20} className="muted" />
          <div className="grow">
            <div>{t('android.title')}</div>
            <div className="faint small">{t('android.text')}</div>
          </div>
        </div>
        <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="btn small">
          <ExternalLink size={16} /> {t('android.download')}
        </a>
      </div>
    );
  }

  const busy = u.status === 'checking' || u.status === 'downloading';
  return (
    <div className="panel update-panel">
      <div className="setting">
        <Smartphone size={20} className="muted" />
        <div className="grow">
          <div>{t('update.version', { version: u.current })}</div>
          <div className="faint small">
            {u.status === 'upToDate' && t('update.upToDate')}
            {u.status === 'checking' && t('update.checking')}
            {u.status === 'error' && t('update.error', { error: u.error ?? '' })}
            {(u.status === 'idle' || u.status === 'error') && !u.latest && t('update.howItWorks')}
          </div>
        </div>
        {(u.status === 'idle' || u.status === 'upToDate' || u.status === 'error' || busy) &&
          u.status !== 'downloading' && (
            <button className="btn small" disabled={busy} onClick={() => void u.check(true)}>
              {u.status === 'checking' ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {t('update.check')}
            </button>
          )}
      </div>

      {u.latest && u.status !== 'upToDate' && u.status !== 'checking' && (
        <div className="update-box">
          <strong>{t('update.available', { version: u.latest.version })}</strong>
          {u.latest.notes && (
            <details>
              <summary className="small">{t('update.whatsNew')}</summary>
              <p className="small muted update-notes">{u.latest.notes}</p>
            </details>
          )}

          {u.status === 'downloading' ? (
            <>
              <div className="meter" aria-hidden>
                <div
                  className="auto"
                  style={{ width: `${Math.round((u.progress ?? 0) * 100)}%` }}
                />
              </div>
              <span className="small muted">
                {t('update.downloading', {
                  percent: u.progress === null ? '' : `${Math.round(u.progress * 100)} %`,
                })}
              </span>
            </>
          ) : u.status === 'needsPermission' ? (
            <>
              <p className="small" style={{ margin: 0 }}>
                <ShieldCheck size={16} color="var(--accent)" style={{ verticalAlign: -3 }} />{' '}
                {t('update.permissionText')}
              </p>
              <div className="row wrap">
                <button className="btn primary small" onClick={() => void u.openPermission()}>
                  {t('update.permissionButton')}
                </button>
                <button className="btn small" onClick={() => void u.update()}>
                  {t('update.retry')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="small muted" style={{ margin: 0 }}>
                {t('update.explain', {
                  size: u.latest.apkBytes ? formatBytes(u.latest.apkBytes) : '≈ 10 MB',
                })}
              </p>
              <button className="btn primary small" onClick={() => void u.update()}>
                <Download size={16} /> {t('update.install')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
