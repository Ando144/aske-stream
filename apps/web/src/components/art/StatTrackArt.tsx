import { findTrackByTitle } from '../../lib/trackLookup';
import { useLibrary } from '../../stores/library';
import { Cover } from '../Cover';
import { GeneratedArt } from './GeneratedArt';

/** Picture for a song known only by title and artist (statistics, groups). */
export function StatTrackArt({
  title,
  artist,
  size = 40,
}: {
  title: string;
  artist: string;
  size?: number;
}) {
  const track = useLibrary((s) => findTrackByTitle(s.tracks, title, artist));
  if (track) return <Cover trackId={track.id} hasCover={track.hasCover} size={size} />;
  return <GeneratedArt seed={`${title}|${artist}`} kind="song" size={size} className="cover" />;
}
