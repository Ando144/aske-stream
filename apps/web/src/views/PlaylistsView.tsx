import { Heart, ListMusic, Plus } from 'lucide-react';
import { Link } from 'wouter';
import type { Playlist, Track } from '@aske/shared';
import { songCount, useT } from '../i18n';
import { useAllTracks, useLibrary } from '../stores/library';
import { promptDialog } from '../stores/ui';
import { Cover } from '../components/Cover';
import { SettingsLink } from '../components/SettingsLink';
import { ScreenTip } from '../components/ScreenTip';

export function PlaylistsView() {
  const t = useT();
  const playlists = useLibrary((s) => s.playlists);
  const tracks = useLibrary((s) => s.tracks);
  const liked = useAllTracks().filter((tr) => tr.likedAt !== null).length;

  const create = async () => {
    const name = await promptDialog({
      title: t('playlists.new'),
      placeholder: t('playlists.namePlaceholder'),
      initial: '',
      confirmLabel: t('common.create'),
    });
    if (name) await useLibrary.getState().createPlaylist(name);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('playlists.title')}</h1>
        <div className="row">
          <button className="btn primary small" onClick={() => void create()}>
            <Plus size={16} /> {t('playlists.new')}
          </button>
          <SettingsLink />
        </div>
      </header>
      <ScreenTip id="playlists" text="tips.playlists" helpId="playlists" />

      <div className="card-list">
        <Link href="/liked" className="card-row">
          <div
            className="collection-art liked single"
            style={{ width: 56, height: 56, borderRadius: 8 }}
          >
            <Heart size={24} fill="currentColor" />
          </div>
          <div className="grow">
            <div className="card-title">{t('liked.title')}</div>
            <div className="muted small">{songCount(t, liked)}</div>
          </div>
        </Link>

        {playlists.map((pl) => (
          <Link key={pl.id} href={`/playlist/${pl.id}`} className="card-row">
            <PlaylistArt playlist={pl} tracks={tracks} size={56} />
            <div className="grow">
              <div className="card-title ellipsis">{pl.name}</div>
              <div className="muted small">{songCount(t, pl.trackIds.length)}</div>
            </div>
          </Link>
        ))}
      </div>

      {playlists.length === 0 && <p className="empty">{t('playlists.empty')}</p>}
    </div>
  );
}

/** 2×2 mosaic of the first covers, like Spotify. */
export function PlaylistArt({
  playlist,
  tracks,
  size,
}: {
  playlist: Playlist;
  tracks: Record<string, Track>;
  size?: number;
}) {
  const withCover = playlist.trackIds.filter((id) => tracks[id]?.hasCover).slice(0, 4);
  const style = size ? { width: size, height: size, borderRadius: 8 } : undefined;
  if (withCover.length < 4) {
    return (
      <div className="collection-art single" style={style}>
        {withCover[0] ? (
          <Cover trackId={withCover[0]} hasCover size={0} className="" />
        ) : (
          <ListMusic size={size ? size * 0.42 : 56} />
        )}
      </div>
    );
  }
  return (
    <div className="collection-art" style={style}>
      {withCover.map((id) => (
        <Cover key={id} trackId={id} hasCover size={0} className="" />
      ))}
    </div>
  );
}
