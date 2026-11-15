import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS, type SendItem } from '@aske/shared';
import {
  buildSearchRequest,
  isYoutubeUrl,
  parseSearchResponse,
  youtubePlaylistId,
  youtubeVideoId,
} from '@aske/shared/youtube';
import type { AppEnv } from '../env';
import { newId } from '../lib/ids';
import { assertId, HttpError, notFound, readJson } from '../lib/http';

/**
 * YouTube search (for the computer, which cannot reach YouTube's search API
 * from the browser) and the "Send to phone" queue. Nothing is downloaded
 * here: the phone does the downloading.
 */

const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  kind: z.enum(['songs', 'videos', 'playlists']).default('songs'),
  lang: z.enum(['es', 'en', 'eu']).default('es'),
});

const httpsUrl = z.string().trim().max(LIMITS.urlMax).default('');

const SendBody = z.object({
  url: z
    .string()
    .trim()
    .max(LIMITS.urlMax)
    .refine(isYoutubeUrl, 'Must be a YouTube or YouTube Music link'),
  title: z.string().trim().max(LIMITS.titleMax).default(''),
  author: z.string().trim().max(LIMITS.titleMax).default(''),
  thumbnail: httpsUrl.refine((u) => !u || u.startsWith('https://'), 'Thumbnail must be https'),
});

const PatchSend = z.object({
  status: z.enum(['pending', 'taken', 'done', 'error']),
  detail: z.string().trim().max(500).default(''),
});

interface SendRow {
  id: string;
  url: string;
  kind: 'video' | 'playlist';
  title: string;
  author: string;
  thumbnail: string;
  status: SendItem['status'];
  detail: string;
  created_at: number;
  updated_at: number;
}

const toItem = (r: SendRow): SendItem => ({
  id: r.id,
  url: r.url,
  kind: r.kind,
  title: r.title,
  author: r.author,
  thumbnail: r.thumbnail,
  status: r.status,
  detail: r.detail,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const youtubeRoutes = new Hono<AppEnv>().get('/search', async (c) => {
  const parsed = SearchQuery.safeParse(c.req.query());
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid search');
  const { q, kind, lang } = parsed.data;
  const req = buildSearchRequest(q, kind, lang);
  let res: Response;
  try {
    res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  } catch {
    throw new HttpError(502, 'search_unavailable', 'YouTube search is not reachable');
  }
  if (!res.ok) throw new HttpError(502, 'search_unavailable', `YouTube answered ${res.status}`);
  return c.json({ results: parseSearchResponse(await res.json()) });
});

export const sendRoutes = new Hono<AppEnv>()
  /** Most recent first; finished items are kept for a week so the computer can see them. */
  .get('/', async (c) => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM send_queue
       WHERE status IN ('pending', 'taken') OR updated_at > ?
       ORDER BY created_at DESC LIMIT 200`,
    )
      .bind(weekAgo)
      .all<SendRow>();
    return c.json(results.map(toItem));
  })

  .post('/', async (c) => {
    const body = await readJson(c, SendBody);
    const playlist = youtubePlaylistId(body.url);
    const video = youtubeVideoId(body.url);
    if (!playlist && !video) {
      throw new HttpError(400, 'validation_error', 'url: not a song or playlist link');
    }
    const now = Date.now();
    const row = await c.env.DB.prepare(
      `INSERT INTO send_queue (id, url, kind, title, author, thumbnail, status, detail, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', '', ?, ?) RETURNING *`,
    )
      .bind(
        newId(),
        body.url,
        video ? 'video' : 'playlist',
        body.title,
        body.author,
        body.thumbnail,
        now,
        now,
      )
      .first<SendRow>();
    return c.json(toItem(row!), 201);
  })

  .patch('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Item');
    const body = await readJson(c, PatchSend);
    const row = await c.env.DB.prepare(
      'UPDATE send_queue SET status = ?, detail = ?, updated_at = ? WHERE id = ? RETURNING *',
    )
      .bind(body.status, body.detail, Date.now(), id)
      .first<SendRow>();
    if (!row) throw notFound('Item');
    return c.json(toItem(row));
  })

  .delete('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Item');
    const res = await c.env.DB.prepare('DELETE FROM send_queue WHERE id = ?').bind(id).run();
    if (!res.meta.changes) throw notFound('Item');
    return c.body(null, 204);
  });
