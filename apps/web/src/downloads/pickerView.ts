import type { MessageKey } from '../i18n';
import type { PlaylistListing } from './playlistReader';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export function pickerSubtitle(
  author: string | undefined,
  total: number | null,
  t: Translate,
): string {
  return [author, total ? t('dl.songsCount', { count: total }) : null].filter(Boolean).join(' · ');
}

export function pickerActionText(
  t: Translate,
  sendsLink: boolean,
  count: number,
  native: boolean,
): string {
  if (sendsLink) return t('send.sendPlaylist');
  return native ? t('dl.downloadAll', { count }) : t('pick.send', { count });
}

export function pickerNotices(
  listing: PlaylistListing | null,
  loading: boolean,
  max: number,
): { partial: boolean; overLimit: boolean } {
  const total = listing?.totalCount ?? null;
  return {
    partial: !!listing && !loading && !listing.complete && !!total,
    overLimit: total !== null && total > max,
  };
}

/** Newly read songs start ticked (up to max); the user's earlier changes are kept. */
export function addFreshSelection(
  prev: ReadonlySet<string>,
  seen: Set<string>,
  ids: readonly string[],
  max: number,
): Set<string> | null {
  const fresh = ids.filter((id) => !seen.has(id));
  if (fresh.length === 0) return null;
  fresh.forEach((id) => seen.add(id));
  const next = new Set(prev);
  for (const id of fresh) if (next.size < max) next.add(id);
  return next;
}
