import { buildSearchRequest, parseSearchPage, type SearchPage } from '@aske/shared/youtube';
import { HubHttpError } from './http';

export async function searchYoutube(
  q: string,
  kind: 'songs' | 'videos',
  lang: string,
  continuation?: string,
): Promise<SearchPage> {
  const req = buildSearchRequest(q, kind, lang, continuation);
  try {
    const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
    if (res.ok) return parseSearchPage(await res.json());
    console.error('YouTube search failed', res.status);
  } catch (err) {
    // The user only gets the generic 502 below; the detail stays in the server log.
    console.error('YouTube search failed', err);
  }
  throw new HubHttpError(502, 'search_unavailable', 'YouTube search is not reachable');
}
