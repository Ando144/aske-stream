import type { Playlist, Track } from '@aske/shared';
import type { StudySource } from './session';

export const CALM_MIN_TRACKS = 10;
export const LONG_TRACK_MS = 6 * 60_000;

const CALM_WORDS = new RegExp(
  [
    'instrumental',
    'lo-?fi',
    'piano',
    'ambient',
    'study|estudio|ikas',
    'classical|clásica|klasiko',
    'chill',
    'relax',
    'focus',
    'soundtrack|\\bost\\b|banda sonora',
    'no vocals|sin letra|letrarik gabe',
    'beats',
    'meditation|meditación',
  ].join('|'),
  'i',
);

type CalmFields = Pick<Track, 'title' | 'artist' | 'album' | 'durationMs'>;
type QueueTrack = CalmFields & Pick<Track, 'id' | 'kind'>;

export function isCalmTrack(t: CalmFields): boolean {
  if (t.durationMs >= LONG_TRACK_MS) return true;
  return CALM_WORDS.test(`${t.title} ${t.artist} ${t.album}`);
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function buildStudyQueue(
  tracks: QueueTrack[],
  playlists: Pick<Playlist, 'id' | 'trackIds'>[],
  source: StudySource,
): { ids: string[]; fellBack: boolean } {
  const music = tracks.filter((t) => t.kind === 'music');
  const all = unique(music.map((t) => t.id));

  if (source.kind === 'calm') {
    const calm = unique(music.filter(isCalmTrack).map((t) => t.id));
    return calm.length >= CALM_MIN_TRACKS
      ? { ids: calm, fellBack: false }
      : { ids: all, fellBack: true };
  }
  if (source.kind === 'playlist') {
    const playlist = playlists.find((p) => p.id === source.id);
    const musicIds = new Set(all);
    const ids = unique((playlist?.trackIds ?? []).filter((id) => musicIds.has(id)));
    return ids.length > 0 ? { ids, fellBack: false } : { ids: all, fellBack: true };
  }
  return { ids: all, fellBack: false };
}
