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
import { driveQuota } from '../storage/drive/home';
import type { DriveQuota } from '../storage/drive/api';

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
  const [drive, setDrive] = useState<DriveQuota | null>(null);
  const [driveError, setDriveError] = useState(false);

  useEffect(() => {
    if (home === 'cloudflare') {
      api
        .storage()
        .then(setCloud)
        .catch(() => setCloudError(true));
    }
    if (home === 'drive') {
      driveQuota()
        .then(setDrive)
        .catch(() => setDriveError(true));
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

  const inDrive = useMemo(() => {
    const list = Object.values(tracks).filter((tr) => tr.locations.drive);
    return { count: list.length, bytes: list.reduce((s, tr) => s + (tr.sizeBytes || 0), 0) };
  }, [tracks]);
  const drivePct = drive?.limit ? Math.min(100, (drive.usage / drive.limit) * 100) : 0;
  const driveLeftSongs = drive?.limit
    ? Math.max(0, Math.floor((drive.limit - drive.usage) / BYTES_PER_SONG))
    : null;

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

      {home === 'drive' && (
        <div className="storage-item">
          <div className="row">
            <HardDrive size={20} className="muted" />
            <div className="grow">
              <div>{t('storage.drive')}</div>
              {drive?.email && <div className="faint small">{drive.email}</div>}
            </div>
            {drive && (
              <strong className="small">
                {drive.limit
                  ? t('storage.ofLimit', {
                      used: formatBytes(drive.usage),
                      limit: formatBytes(drive.limit),
                    })
                  : formatBytes(drive.usage)}
              </strong>
            )}
          </div>
          {drive?.limit ? (
            <div className="meter" aria-hidden>
              <div
                className={drivePct >= 90 ? 'danger' : 'auto'}
                style={{ width: `${Math.max(drivePct, 1)}%` }}
              />
            </div>
          ) : null}
          <div className="faint small">
            {t('storage.driveMusic', {
              count: inDrive.count,
              size: formatBytes(inDrive.bytes),
            })}
          </div>
          {driveLeftSongs !== null && (
            <div className="faint small">
              {driveLeftSongs > 0
                ? t('storage.cloudLeft', { count: driveLeftSongs.toLocaleString() })
                : t('storage.driveFull')}
            </div>
          )}
          {drivePct >= 90 && (
            <div className="banner small">
              <TriangleAlert size={16} /> {t('storage.driveAlmostFull')}
            </div>
          )}
          <div className="faint small">{t('storage.driveHint')}</div>
          {driveError && <div className="faint small">{t('storage.driveUnavailable')}</div>}
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

      {(home === 'cloudflare' || home === 'drive') && (
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
