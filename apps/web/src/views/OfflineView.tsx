import { useEffect, useMemo } from 'react';
import { ArrowDownToLine, CircleMinus, RefreshCw } from 'lucide-react';
import type { LocalTrack as Track } from '../storage/types';
import { useI18n, useT, type Translate } from '../i18n';
import { formatBytes, formatLongDuration } from '../lib/format';
import { isExpired } from '../offline/planner';
import { useLibrary } from '../stores/library';
import { QUOTA_OPTIONS, ROTATE_OPTIONS, useOffline } from '../stores/offline';
import { usePlayer } from '../stores/player';
import { confirmDialog } from '../stores/ui';
import { Cover } from '../components/Cover';
import { useSetup } from '../stores/setup';
import { SettingsLink } from '../components/SettingsLink';

const quotaLabel = (t: Translate, min: number) =>
  min >= 60 ? formatLongDuration(min * 60_000) : t('offline.minutes', { n: min });
const rotateLabel = (t: Translate, h: number) =>
  h >= 48 && h % 24 === 0 ? t('offline.days', { n: h / 24 }) : t('offline.hours', { n: h });

function relativeTime(language: string, at: number): string {
  const diffMin = Math.round((at - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 48) return rtf.format(diffH, 'hour');
  return rtf.format(Math.round(diffH / 24), 'day');
}

export function OfflineView() {
  const t = useT();
  const language = useI18n((s) => s.language);
  const settings = useOffline((s) => s.settings);
  const entries = useOffline((s) => s.entries);
  const running = useOffline((s) => s.running);
  const lastRunAt = useOffline((s) => s.lastRunAt);
  const storageBytes = useOffline((s) => s.storageBytes);
  const tracks = useLibrary((s) => s.tracks);
  const home = useSetup((s) => s.config?.home);
  const offline = useOffline.getState();

  useEffect(() => {
    void useOffline.getState().refreshStorage();
  }, []);

  const list = useMemo(
    () =>
      Object.values(entries)
        .map((e) => ({ entry: e, track: tracks[e.trackId] }))
        .filter((x): x is { entry: (typeof x)['entry']; track: Track } => !!x.track)
        .sort(
          (a, b) =>
            Number(a.entry.mode === 'auto') - Number(b.entry.mode === 'auto') ||
            b.entry.downloadedAt - a.entry.downloadedAt,
        ),
    [entries, tracks],
  );

  const pinnedMs = list
    .filter((x) => x.entry.mode === 'pinned')
    .reduce((s, x) => s + x.entry.durationMs, 0);
  const autoMs = list
    .filter((x) => x.entry.mode === 'auto')
    .reduce((s, x) => s + x.entry.durationMs, 0);
  const quotaMs = settings.quotaMinutes * 60_000;
  const scale = Math.max(quotaMs, pinnedMs + autoMs) || 1;
  const rotateMs = settings.rotateAfterHours * 3_600_000;
  const playAll = () =>
    usePlayer.getState().playTracks(
      list.map((x) => x.track.id),
      null,
      { context: { label: t('offline.title'), path: '/offline' } },
    );

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('offline.title')}</h1>
        <div className="row">
          <button
            className="btn small"
            onClick={() => void offline.run()}
            disabled={running}
            aria-label={running ? t('offline.running') : t('offline.refresh')}
          >
            <RefreshCw size={16} className={running ? 'spin' : ''} />
            <span className="hide-narrow">
              {running ? t('offline.running') : t('offline.refresh')}
            </span>
          </button>
          <SettingsLink />
        </div>
      </header>
      <p className="muted">{t('offline.subtitle')}</p>
      {home === 'device' && <div className="banner">{t('offline.deviceHome')}</div>}

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <strong>
            {t('offline.usage', {
              used: formatLongDuration(pinnedMs + autoMs),
              quota: quotaLabel(t, settings.quotaMinutes),
            })}
          </strong>
          <span className="faint small">
            {t('offline.lastRun', {
              time: lastRunAt ? relativeTime(language, lastRunAt) : t('offline.never'),
            })}
          </span>
        </div>
        <div className="meter" aria-hidden>
          <div className="pinned" style={{ width: `${(pinnedMs / scale) * 100}%` }} />
          <div className="auto" style={{ width: `${(autoMs / scale) * 100}%` }} />
        </div>
        <div className="row wrap small muted" style={{ marginTop: 10, gap: '6px 18px' }}>
          <span className="row" style={{ gap: 6 }}>
            <span className="pill pinned">{t('offline.pinned')}</span>
            {t('offline.pinnedCount', {
              count: list.filter((x) => x.entry.mode === 'pinned').length,
            })}
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="pill auto">{t('offline.auto')}</span>
            {t('offline.autoCount', { count: list.filter((x) => x.entry.mode === 'auto').length })}
          </span>
        </div>
        {pinnedMs > quotaMs && (
          <p className="small" style={{ color: 'var(--warn-text)' }}>
            {t('offline.pinnedOverQuota')}
          </p>
        )}
        {storageBytes !== null && (
          <p className="faint small" style={{ marginBottom: 0 }}>
            {t('offline.storage', { size: formatBytes(storageBytes) })}
          </p>
        )}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="setting">
          <label className="grow" htmlFor="quota">
            {t('offline.quota')}
          </label>
          <select
            id="quota"
            className="select"
            value={settings.quotaMinutes}
            onChange={(e) => offline.updateSettings({ quotaMinutes: Number(e.target.value) })}
          >
            {QUOTA_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {quotaLabel(t, m)}
              </option>
            ))}
          </select>
        </div>
        <div className="setting">
          <label className="grow" htmlFor="rotate">
            {t('offline.rotateAfter')}
          </label>
          <select
            id="rotate"
            className="select"
            value={settings.rotateAfterHours}
            onChange={(e) => offline.updateSettings({ rotateAfterHours: Number(e.target.value) })}
          >
            {ROTATE_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {rotateLabel(t, h)}
              </option>
            ))}
          </select>
        </div>
        <ToggleSetting
          id="autofill"
          label={t('offline.autoFill')}
          hint={t('offline.autoFillHint')}
          checked={settings.autoFill}
          onChange={(v) => offline.updateSettings({ autoFill: v })}
        />
        <ToggleSetting
          id="cellular"
          label={t('offline.allowCellular')}
          hint={t('offline.allowCellularHint')}
          checked={settings.allowCellular}
          onChange={(v) => offline.updateSettings({ allowCellular: v })}
        />
      </div>

      <div className="row" style={{ marginTop: 24, justifyContent: 'space-between' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          <ArrowDownToLine size={18} /> {list.length}
        </h2>
        <div className="row">
          <button className="btn small" onClick={playAll} disabled={!list.length}>
            {t('common.play')}
          </button>
          <button
            className="btn small danger"
            disabled={!list.some((x) => x.entry.mode === 'auto')}
            onClick={async () => {
              if (await confirmDialog(t('offline.clearAutoConfirm'), t('common.delete'), true)) {
                await offline.clearAuto();
              }
            }}
          >
            {t('offline.clearAuto')}
          </button>
        </div>
      </div>

      {list.length === 0 && <p className="empty">{t('offline.empty')}</p>}
      <div className="track-list" style={{ marginTop: 8 }}>
        {list.map(({ entry, track }) => {
          const heard = entry.listenedAt !== null;
          const expired = isExpired(entry, Date.now(), rotateMs);
          return (
            <div key={track.id} className="track">
              <Cover trackId={track.id} hasCover={track.hasCover} />
              <div className="grow track-text">
                <div className="track-title">{track.title}</div>
                <div className="track-sub">
                  <span className={`pill ${entry.mode}`}>
                    {entry.mode === 'pinned' ? t('offline.pinned') : t('offline.auto')}
                  </span>
                  <span>
                    {track.artist}
                    {entry.mode === 'auto' && heard && (
                      <>
                        {' · '}
                        {t('offline.heard')}{' '}
                        {expired
                          ? t('offline.rotatesSoon')
                          : t('offline.rotatesIn', {
                              time: relativeTime(language, entry.listenedAt! + rotateMs),
                            })}
                      </>
                    )}
                  </span>
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={() => void offline.unpin(track.id)}
                aria-label={t('track.removeDownload')}
              >
                <CircleMinus size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToggleSetting(props: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting">
      <label className="grow" htmlFor={props.id}>
        <div>{props.label}</div>
        <div className="faint small">{props.hint}</div>
      </label>
      <span className="toggle">
        <input
          id={props.id}
          type="checkbox"
          role="switch"
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
        />
        <span />
      </span>
    </div>
  );
}
