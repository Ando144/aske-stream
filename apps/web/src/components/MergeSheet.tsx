import { useState } from 'react';
import { useLocation } from 'wouter';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { Sheet } from './Sheet';

/** Confirms merging `sourceId` into `targetId`. The other playlist is deleted unless unticked. */
export function MergeSheet({
  targetId,
  sourceId,
  onClose,
}: {
  targetId: string;
  sourceId: string;
  onClose: () => void;
}) {
  const t = useT();
  const [location, navigate] = useLocation();
  const [swapped, setSwapped] = useState(false);
  const [deleteSource, setDeleteSource] = useState(true);
  const [busy, setBusy] = useState(false);
  const playlists = useLibrary((s) => s.playlists);

  const target = playlists.find((p) => p.id === (swapped ? sourceId : targetId));
  const source = playlists.find((p) => p.id === (swapped ? targetId : sourceId));
  if (!target || !source) return null;

  const confirm = async () => {
    setBusy(true);
    const merged = await useLibrary.getState().mergePlaylists(target.id, source.id, deleteSource);
    setBusy(false);
    if (!merged) return;
    onClose();
    const openId = location.match(/\/playlist\/([^/]+)/)?.[1];
    if (deleteSource && openId === source.id) navigate(`/playlist/${target.id}`, { replace: true });
  };

  return (
    <Sheet onClose={onClose} label={t('merge.title')}>
      <h2>{t('merge.title')}</h2>
      <p>{t('merge.explain', { source: source.name, target: target.name })}</p>
      <label className="row" style={{ gap: 8, margin: '12px 0 4px' }}>
        <input
          type="checkbox"
          checked={deleteSource}
          onChange={(e) => setDeleteSource(e.target.checked)}
        />
        {t('merge.deleteOther', { source: source.name })}
      </label>
      <p className="muted small">{t('merge.deleteOtherHint')}</p>
      <div className="row wrap" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => setSwapped(!swapped)} disabled={busy}>
          {t('merge.swap')}
        </button>
        <span className="grow" />
        <button className="btn primary" onClick={() => void confirm()} disabled={busy}>
          {t('merge.confirm')}
        </button>
      </div>
    </Sheet>
  );
}
