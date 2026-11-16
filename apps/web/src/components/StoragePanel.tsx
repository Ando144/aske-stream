import { useEffect, useMemo, useState } from 'react';
import { Cloud, HardDrive, Smartphone, TriangleAlert, WifiOff } from 'lucide-react';
import type { StorageStats } from '@aske/shared';
import { api } from '../api/client';
import { useT } from '../i18n';
import { formatBytes } from '../lib/format';
import { AskeNative } from '../native/askeNative';
import { isNative } from '../native/platform';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { useSetup } from '../stores/setup';

/** Average song ≈ 4 MB (same estimate as the storage choice screen). */
const BYTES_PER_SONG = 4_000_000;

/**
 * Settings → Storage: how much space the music takes wherever it lives, how
 * much is left, and — for Cloudflare — how far from the free 10 GB.
 */
export function StoragePanel() {
  const t = useT();
  const home = useSetup((s) => s.config?.home);
  const tracks = useLibrary((s) => s.tracks);
  const offline = useOffline((s) => s.entries);
  const [cloud, setCloud] = useState<StorageStats | null>(null);
  const [cloudError, setCloudError] = useState(false);
  const [device, setDevice] = useState<{ free: number; total: number | null } | null>(null);

  useEffect(() => {
    if (home === 'cloudflare') {
      api
        .storage()
        .then(setCloud)
        .catch(() => setCloudError(true));
    }
    if (isNative) {
      AskeNative.storageInfo()
        .then((s) => setDevice({ free: s.freeBytes, total: s.totalBytes }))
        .catch(() => undefined);
    } else {
      navigator.storage
        ?.estimate?.()
        .then((e) => e.quota && setDevice({ free: (e.quota ?? 0) - (e.usage ?? 0), total: null }))
        .catch(() => undefined);
    }
  }, [home]);

  const onDevice = useMemo(() => {
    const list = Object.values(tracks).filter((tr) => tr.locations.device);
    return { count: list.length, bytes: list.reduce((s, tr) => s + (tr.sizeBytes || 0), 0) };
  }, [tracks]);
  const offlineCopies = useMemo(() => {
    const list = Object.values(offline);
    return { count: list.length, bytes: list.reduce((s, e) => s + (e.sizeBytes || 0), 0) };
  }, [offline]);

  const cloudPct = cloud ? Math.min(100, (cloud.usedBytes / cloud.limitBytes) * 100) : 0;
  const cloudLeftSongs = cloud
    ? Math.max(0, Math.floor((cloud.uploadLimitBytes - cloud.usedBytes) / BYTES_PER_SONG))
    : 0;

  return (
    <div className="panel storage-panel">
      {home === 'cloudflare' && (
        <div className="storage-item">
          <div className="row">
            <Cloud size={20} className="muted" />
            <div className="grow">{t('storage.cloud')}</div>
            {cloud && (
              <strong className="small">
                {t('storage.ofLimit', {
                  used: formatBytes(cloud.usedBytes),
                  limit: formatBytes(cloud.limitBytes),
                })}
              </strong>
            )}
          </div>
          {cloud && (
            <>
              <div className="meter" aria-hidden>
                <div
                  className={cloudPct >= 90 ? 'danger' : 'auto'}
                  style={{ width: `${Math.max(cloudPct, 1)}%` }}
                />
              </div>
              <div className="faint small">
                {cloudLeftSongs > 0
                  ? t('storage.cloudLeft', { count: cloudLeftSongs.toLocaleString() })
                  : t('storage.cloudFull')}
              </div>
              {cloudPct >= 90 && cloudLeftSongs > 0 && (
                <div className="banner small">
                  <TriangleAlert size={16} /> {t('storage.cloudAlmostFull')}
                </div>
              )}
              <div className="faint small">{t('storage.cloudHint')}</div>
            </>
          )}
          {cloudError && <div className="faint small">{t('storage.cloudUnavailable')}</div>}
        </div>
      )}

      {home === 'device' && (
        <div className="storage-item row">
          <Smartphone size={20} className="muted" />
          <div className="grow">{t('storage.onDevice')}</div>
          <strong className="small">
            {t('storage.songsSize', { count: onDevice.count, size: formatBytes(onDevice.bytes) })}
          </strong>
        </div>
      )}

      {home === 'cloudflare' && (
        <div className="storage-item row">
          <WifiOff size={20} className="muted" />
          <div className="grow">{t('storage.offlineCopies')}</div>
          <strong className="small">
            {t('storage.songsSize', {
              count: offlineCopies.count,
              size: formatBytes(offlineCopies.bytes),
            })}
          </strong>
        </div>
      )}

      {device && (
        <div className="storage-item row">
          <HardDrive size={20} className="muted" />
          <div className="grow">
            <div>{isNative ? t('storage.phoneFree') : t('storage.browserFree')}</div>
            <div className="faint small">
              {t('storage.fitsSongs', {
                count: Math.floor(device.free / BYTES_PER_SONG).toLocaleString(),
              })}
            </div>
          </div>
          <strong className="small">
            {device.total
              ? t('storage.freeOf', {
                  free: formatBytes(device.free),
                  total: formatBytes(device.total),
                })
              : formatBytes(device.free)}
          </strong>
        </div>
      )}
    </div>
  );
}
