import { useEffect, useMemo, useState } from 'react';
import { Copy, LoaderCircle, Share2 } from 'lucide-react';
import type { Playlist } from '@aske/shared';
import { hubListLink } from '@aske/shared/hub';
import { HUB_URL } from '../config';
import { useI18n, useT } from '../i18n';
import { createSharedList, deleteSharedList, hubAvailable, HubError } from '../hub/client';
import { hubErrorText } from '../hub/errors';
import { songsFromPlaylist } from '../hub/sharedList';
import { useLibrary } from '../stores/library';
import { useSharedLists, type MyShare } from '../stores/sharedLists';
import { toast } from '../stores/ui';
import { QrCode } from './QrCode';
import { Sheet } from './Sheet';

/** Creates (or reuses) the link of a playlist; `error` is already translated. */
function useShare(playlist: Playlist, songs: ReturnType<typeof songsFromPlaylist>['songs']) {
  const t = useT();
  const [share, setShare] = useState<MyShare | undefined>(() =>
    useSharedLists.getState().forPlaylist(playlist.id),
  );
  const [error, setError] = useState<string | null>(null);
  const canCreate = hubAvailable() && songs.length > 0;

  useEffect(() => {
    if (share || !canCreate) return;
    let cancelled = false;
    createSharedList(playlist.name, songs)
      .then((created) => {
        const mine = { playlistId: playlist.id, ...created };
        useSharedLists.getState().add(mine);
        if (!cancelled) setShare(mine);
      })
      .catch((err) => !cancelled && setError(hubErrorText(err)));
    return () => {
      cancelled = true;
    };
  }, [share, canCreate, playlist.id, playlist.name, songs]);

  const stop = async (): Promise<boolean> => {
    if (!share) return false;
    try {
      await deleteSharedList(share.id, share.deleteKey);
    } catch (err) {
      // A link that is already gone counts as stopped.
      if (!(err instanceof HubError && (err.status === 404 || err.status === 410))) {
        setError(hubErrorText(err));
        return false;
      }
    }
    useSharedLists.getState().remove(share.id);
    toast(t('share.stopped'));
    return true;
  };
  return { share, error, stop };
}

function LinkBlock({ share, name, skipped }: { share: MyShare; name: string; skipped: number }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const link = hubListLink(HUB_URL, share.id);
  const canShare = typeof navigator.share === 'function';

  const send = async () => {
    if (canShare) {
      await navigator.share({ text: t('share.shareText', { name }), url: link }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(link).then(
      () => toast(t('share.copied')),
      () => toast(t('hub.err.internal_error'), 'error'),
    );
  };

  return (
    <div className="link-device-code">
      <QrCode text={link} label={t('share.qrLabel')} />
      <div className="small muted">{t('share.link')}</div>
      <code className="small" style={{ wordBreak: 'break-all' }}>
        {link}
      </code>
      <div className="faint small">
        {t('share.expires', { date: new Date(share.expiresAt).toLocaleDateString(language) })}
      </div>
      {skipped > 0 && <div className="faint small">{t('share.skipped', { count: skipped })}</div>}
      <button className="btn small" onClick={() => void send()}>
        {canShare ? <Share2 size={16} /> : <Copy size={16} />}
        {t(canShare ? 'share.shareLink' : 'share.copyLink')}
      </button>
    </div>
  );
}

/** «Share» sheet of a playlist: QR, link and «Stop sharing». */
export function SharePlaylistSheet({
  playlist,
  onClose,
}: {
  playlist: Playlist;
  onClose: () => void;
}) {
  const t = useT();
  const tracks = useLibrary((s) => s.tracks);
  const { songs, skipped } = useMemo(
    () => songsFromPlaylist(playlist.trackIds, tracks),
    [playlist.trackIds, tracks],
  );
  const { share, error, stop } = useShare(playlist, songs);

  let body;
  if (!hubAvailable()) {
    body = <p className="muted">{t('share.comingSoonText')}</p>;
  } else if (songs.length === 0) {
    body = <p className="muted">{t('share.noYoutube')}</p>;
  } else if (share) {
    body = <LinkBlock share={share} name={playlist.name} skipped={skipped} />;
  } else if (!error) {
    body = (
      <p className="muted">
        <LoaderCircle size={16} className="spin" /> {t('share.creating')}
      </p>
    );
  }

  return (
    <Sheet onClose={onClose} label={t('share.title')}>
      <div className="sheet-header">
        <div className="grow">
          <div className="track-title">{t('share.title')}</div>
          <div className="faint small">{t('share.intro')}</div>
        </div>
      </div>
      <div className="sheet-body">
        {body}
        {error && <div className="error-text">{error}</div>}
        {share && (
          <button
            className="btn small danger"
            onClick={() =>
              void stop().then((ok) => {
                if (ok) onClose();
              })
            }
          >
            {t('share.stop')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
