import { describe, expect, it, vi } from 'vitest';
import type { PlaylistPage } from '@aske/shared/youtube';
import {
  emptyRead,
  listingFromRead,
  readPages,
  type PageFetcher,
} from '../src/downloads/playlistReader';

const entry = (n: number) => ({ id: `v${n}`, title: `T${n}`, author: 'A', duration: 10 });
const page = (ids: number[], continuation: string | null, extra: Partial<PlaylistPage> = {}) =>
  ({
    title: 'List',
    author: 'Me',
    entries: ids.map(entry),
    continuation,
    totalCount: null,
    unavailable: 0,
    ...extra,
  }) satisfies PlaylistPage;

const fetcher = (pages: (PlaylistPage | null)[]): PageFetcher => {
  let i = 0;
  return async () => pages[i++] ?? null;
};

describe('readPages', () => {
  it('reads several pages, dedupes and takes the header from page 0', async () => {
    const read = emptyRead();
    const onPage = vi.fn();
    await readPages(
      fetcher([page([1, 2], 'c1', { totalCount: 4 }), page([2, 3, 4], null, { title: 'Other' })]),
      read,
      { maxPages: 5, onPage },
    );
    expect(read.entries.map((e) => e.id)).toEqual(['v1', 'v2', 'v3', 'v4']);
    expect(read).toMatchObject({ title: 'List', author: 'Me', totalCount: 4, exhausted: true });
    expect(onPage).toHaveBeenCalledTimes(2);
  });

  it('stops at maxPages without being exhausted', async () => {
    const read = emptyRead();
    await readPages(fetcher([page([1], 'c1'), page([2], 'c2'), page([3], null)]), read, {
      maxPages: 2,
    });
    expect(read.entries).toHaveLength(2);
    expect(read.exhausted).toBe(false);
  });

  it('cuts the entries at maxSongs', async () => {
    const read = emptyRead();
    await readPages(fetcher([page([1, 2, 3], 'c1'), page([4], null)]), read, {
      maxPages: 5,
      maxSongs: 2,
    });
    expect(read.entries.map((e) => e.id)).toEqual(['v1', 'v2']);
    expect(read.exhausted).toBe(false);
  });

  it('stops on a refused page and keeps what it had', async () => {
    const read = emptyRead();
    await readPages(fetcher([page([1], 'c1'), null]), read, { maxPages: 5 });
    expect(read.entries).toHaveLength(1);
    expect(read.exhausted).toBe(false);
  });

  it('stops on an empty page that still has a continuation', async () => {
    const read = emptyRead();
    const fetchPage = vi.fn(fetcher([page([1], 'c1'), page([], 'c2'), page([9], null)]));
    await readPages(fetchPage, read, { maxPages: 5 });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(read.exhausted).toBe(false);
  });

  it('adds up the unavailable videos of every page', async () => {
    const read = emptyRead();
    await readPages(
      fetcher([page([1], 'c1', { unavailable: 2 }), page([2], null, { unavailable: 1 })]),
      read,
      { maxPages: 5 },
    );
    expect(read.skipped).toBe(3);
  });
});

describe('listingFromRead', () => {
  it('counts hidden videos once the list is exhausted', () => {
    const read = { ...emptyRead(), entries: [entry(1), entry(2)], totalCount: 5, exhausted: true };
    expect(listingFromRead(read)).toMatchObject({ complete: true, unavailable: 3 });
  });

  it('is incomplete when not exhausted and short of the total', () => {
    const read = { ...emptyRead(), entries: [entry(1)], totalCount: 5, skipped: 1 };
    expect(listingFromRead(read)).toMatchObject({ complete: false, unavailable: 1 });
  });
});
