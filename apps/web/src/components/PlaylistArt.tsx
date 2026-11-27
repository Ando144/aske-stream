import { useEffect, useState } from 'react';
import type { Playlist, Track } from '@aske/shared';
import { mosaicTrackIds } from '../lib/playlistMosaic';
import { resolvePlaylistCoverUrl } from '../storage/media';
import { GeneratedArt } from './art/GeneratedArt';
import { Cover } from './Cover';

/** Custom photo when the playlist has one; otherwise its song covers or the amber drawing. */
export function PlaylistArt({
  playlist,
  tracks,
  size,
}: {
  playlist: Playlist;
  tracks: Record<string, Track>;
  size?: number;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBroken(false);
    Promise.resolve(playlist.coverAt ? resolvePlaylistCoverUrl(playlist) : null)
      .then((url) => !cancelled && setPhoto(url))
      .catch(() => !cancelled && setPhoto(null));
    return () => {
      cancelled = true;
    };
  }, [playlist]);

  const style = size ? { width: size, height: size, borderRadius: 8 } : undefined;
  if (photo && !broken) {
    return (
      <div className="collection-art single" style={style}>
        <img src={photo} alt="" onError={() => setBroken(true)} />
      </div>
    );
  }

  const ids = mosaicTrackIds(playlist.trackIds, tracks);
  return (
    <div className={ids.length > 1 ? 'collection-art' : 'collection-art single'} style={style}>
      {ids.length === 0 ? (
        <GeneratedArt seed={playlist.name} kind="playlist" />
      ) : (
        ids.map((id) => (
          <Cover
            key={id}
            trackId={id}
            hasCover={tracks[id]?.hasCover ?? false}
            size={0}
            className=""
          />
        ))
      )}
    </div>
  );
}
