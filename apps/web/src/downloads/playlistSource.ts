import { LIMITS } from '@aske/shared';
import { HUB_LIMITS } from '@aske/shared/hub';
import { classifyPlaylistLink } from '@aske/shared/youtube';
import type { Language } from '../i18n';
import { fetchPlaylistPage, HubError } from '../hub/client';
import { withTimeout, isTimeout } from '../lib/timeout';
import { listPlaylistOnPhone } from '../native/downloader';
import { isNative } from '../native/platform';
import { emptyRead, listingFromRead, readPages, type PlaylistListing } from './playlistReader';

export type PlaylistProblem = 'mix' | 'personal' | 'none' | 'private';

export class PlaylistLinkError extends Error {
  constructor(readonly reason: PlaylistProblem) {
    super(reason);
    this.name = 'PlaylistLinkError';
  }
}

export const HUB_PLAYLIST_TIMEOUT_MS = 60_000;

async function listOnPhone(
  url: string,
  lang: Language,
  onPartial?: (partial: PlaylistListing) => void,
): Promise<PlaylistListing> {
  const listing = await listPlaylistOnPhone(url, lang, onPartial);
  if (listing.entries.length === 0) throw new PlaylistLinkError('private');
  if (listing.entries.length <= LIMITS.playlistMaxTracks) return listing;
  return {
    ...listing,
    entries: listing.entries.slice(0, LIMITS.playlistMaxTracks),
    complete: false,
  };
}

async function listViaHub(
  id: string,
  lang: Language,
  onPartial?: (partial: PlaylistListing) => void,
): Promise<PlaylistListing> {
  const read = emptyRead();
  try {
    await withTimeout(
      readPages((c) => fetchPlaylistPage(id, c, lang), read, {
        maxPages: HUB_LIMITS.playlistMaxPages,
        maxSongs: LIMITS.playlistMaxTracks,
        onPage: (r) => onPartial?.(listingFromRead(r)),
      }),
      HUB_PLAYLIST_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof HubError && err.code === 'playlist_unavailable') {
      throw new PlaylistLinkError('private');
    }
    // A timeout that already read songs keeps them; anything else is the caller's to handle.
    if (!(isTimeout(err) && read.entries.length > 0)) throw err;
  }
  return listingFromRead(read);
}

/** Phone: YouTube directly (listPlaylistOnPhone); computer: through the Hub. */
export async function listPlaylist(
  url: string,
  lang: Language,
  onPartial?: (partial: PlaylistListing) => void,
): Promise<PlaylistListing> {
  const link = classifyPlaylistLink(url);
  if (link.kind !== 'playlist') throw new PlaylistLinkError(link.kind);
  if (isNative) return listOnPhone(url, lang, onPartial);
  return listViaHub(link.id, lang, onPartial);
}
