import { buildBrowseRequest, parsePlaylistPage } from '@aske/shared/youtube';
import type { PlaylistPage } from '@aske/shared/youtube';
import { HubHttpError } from './http';

export async function fetchPlaylistPage(
  id: string,
  continuation: string | null,
  lang: string,
): Promise<PlaylistPage> {
  const req = buildBrowseRequest(id, continuation, lang);
  try {
    const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
    if (res.ok) return parsePlaylistPage(await res.json());
  } catch (err) {
    // The user only gets the generic 502 below; the detail stays in the server log.
    console.error('YouTube playlist read failed', err);
  }
  throw new HubHttpError(502, 'search_unavailable', 'YouTube is not reachable');
}
