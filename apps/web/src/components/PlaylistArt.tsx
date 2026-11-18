import { useEffect, useState } from 'react';
import { ListMusic } from 'lucide-react';
import type { Playlist, Track } from '@aske/shared';
import { resolvePlaylistCoverUrl } from '../storage/media';
import { Cover } from './Cover';

/** Custom photo when the playlist has one; otherwise a 2×2 mosaic of the first covers. */
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

  const withCover = playlist.trackIds.filter((id) => tracks[id]?.hasCover).slice(0, 4);
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
