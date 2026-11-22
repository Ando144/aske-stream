import {
  countUnavailable,
  isPlaylistComplete,
  type PlaylistEntry,
  type PlaylistPage,
} from '@aske/shared/youtube';

export interface PlaylistListing {
  title: string;
  author: string;
  entries: PlaylistEntry[];
  /** Videos the playlist header announces; null when unknown. */
  totalCount: number | null;
  /** false when fewer songs were read than announced and nothing more could be read. */
  complete: boolean;
  /** Songs that could not be listed (private/deleted); shown to the user, never sent. */
  unavailable: number;
}

/** null = YouTube refused this page (non-200). */
export type PageFetcher = (continuation: string | null) => Promise<PlaylistPage | null>;

/** What was read so far; filled in place so a timeout keeps the partial result. */
export interface PlaylistRead {
  title: string;
  author: string;
  entries: PlaylistEntry[];
  totalCount: number | null;
  /** YouTube said there is nothing more to read. */
  exhausted: boolean;
  skipped: number;
}

export function emptyRead(): PlaylistRead {
  return { title: '', author: '', entries: [], totalCount: null, exhausted: false, skipped: 0 };
}

function addPage(read: PlaylistRead, page: PlaylistPage, first: boolean): void {
  if (first) {
    read.title = page.title;
    read.author = page.author;
    read.totalCount = page.totalCount;
  }
  const known = new Set(read.entries.map((e) => e.id));
  read.entries.push(...page.entries.filter((e) => !known.has(e.id)));
  read.skipped += page.unavailable;
}

/**
 * Reads pages until maxPages, maxSongs, the end of the list, a refused page or an empty one.
 * Calls `onPage` after each page that was added.
 */
export async function readPages(
  fetchPage: PageFetcher,
  read: PlaylistRead,
  limits: { maxPages: number; maxSongs?: number; onPage?: (read: PlaylistRead) => void },
): Promise<void> {
  let continuation: string | null = null;
  for (let index = 0; index < limits.maxPages; index++) {
    const page = await fetchPage(continuation);
    if (!page) return;
    addPage(read, page, index === 0);
    if (limits.maxSongs !== undefined && read.entries.length >= limits.maxSongs) {
      read.entries.length = limits.maxSongs;
      limits.onPage?.(read);
      return;
    }
    limits.onPage?.(read);
    continuation = page.continuation;
    if (!continuation) {
      read.exhausted = true;
      return;
    }
    if (page.entries.length === 0) return;
  }
}

export function listingFromRead(read: PlaylistRead): PlaylistListing {
  const count = read.entries.length;
  return {
    title: read.title,
    author: read.author,
    entries: read.entries,
    totalCount: read.totalCount,
    complete: isPlaylistComplete(count, read.totalCount, read.exhausted),
    unavailable: countUnavailable(read.skipped, count, read.totalCount, read.exhausted),
  };
}
