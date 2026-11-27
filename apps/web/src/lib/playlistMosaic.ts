import type { Track } from '@aske/shared';

const TILES = 4;

/** Which songs picture a playlist: four for a 2×2 mosaic, otherwise one (or none). */
export function mosaicTrackIds(
  trackIds: readonly string[],
  tracks: Record<string, Track>,
): string[] {
  const known = trackIds.filter((id) => tracks[id]);
  const withCover = known.filter((id) => tracks[id]?.hasCover);
  const withoutCover = known.filter((id) => !tracks[id]?.hasCover);
  return [...withCover, ...withoutCover].slice(0, known.length < TILES ? 1 : TILES);
}
