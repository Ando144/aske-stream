import type { SearchPage, SearchResult } from '@aske/shared/youtube';

/** The results on screen and whether YouTube can give more. */
export interface PagedResults {
  results: SearchResult[];
  continuation: string | null;
  /** True once asking for more has reached the end. */
  ended: boolean;
}

/** Adds the next page; YouTube repeats some results between pages, so those are dropped. */
export function appendResults(
  prev: readonly SearchResult[],
  next: readonly SearchResult[],
): SearchResult[] {
  const byKey = new Map<string, SearchResult>();
  for (const result of [...prev, ...next]) {
    const key = `${result.kind}:${result.id}`;
    if (!byKey.has(key)) byKey.set(key, result);
  }
  return [...byKey.values()];
}

/** An empty page also ends the list, so the button never keeps asking for nothing. */
export function withNextPage<T extends PagedResults>(list: T, page: SearchPage): T {
  const continuation = page.results.length ? page.continuation : null;
  return {
    ...list,
    results: appendResults(list.results, page.results),
    continuation,
    ended: !continuation,
  };
}
