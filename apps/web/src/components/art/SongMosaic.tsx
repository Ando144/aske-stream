import type { HubSong } from '@aske/shared/hub';
import { SongThumb } from '../SongThumb';
import { GeneratedArt } from './GeneratedArt';

/** Picture of a list of shared songs: a 2×2 mosaic, one thumbnail or the amber drawing. */
export function SongMosaic({
  songs,
  seed,
  size = 48,
}: {
  songs: readonly HubSong[];
  seed: string;
  size?: number;
}) {
  const first = songs[0];
  if (!first) {
    return <GeneratedArt seed={seed} kind="playlist" size={size} className="cover" />;
  }
  if (songs.length < 4) {
    return (
      <SongThumb videoId={first.videoId} title={first.title} artist={first.artist} size={size} />
    );
  }
  return (
    <div className="song-mosaic" style={{ width: size, height: size }} aria-hidden>
      {songs.slice(0, 4).map((song, i) => (
        <SongThumb
          key={`${i}-${song.videoId}`}
          videoId={song.videoId}
          title={song.title}
          artist={song.artist}
          size={0}
        />
      ))}
    </div>
  );
}
