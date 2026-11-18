import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { audioKey, coverKey, playlistCoverKey } from '../lib/db';
import { assertId, HttpError } from '../lib/http';

/** Computes the byte window R2 actually returned for a ranged GET. */
export function resolveRange(
  range: R2Range | undefined,
  size: number,
): { offset: number; length: number } | null {
  if (!range) return null;
  if ('suffix' in range && range.suffix !== undefined) {
    const length = Math.min(range.suffix, size);
    return { offset: size - length, length };
  }
  const offset = 'offset' in range && range.offset !== undefined ? range.offset : 0;
  const length =
    'length' in range && range.length !== undefined
      ? Math.min(range.length, size - offset)
      : size - offset;
  return { offset, length };
}

async function serveObject(
  bucket: R2Bucket,
  key: string,
  request: Request,
  cacheControl: string,
): Promise<Response> {
  const wantsRange = request.headers.has('range');
  let object: R2Object | R2ObjectBody | null;
  try {
    object = await bucket.get(key, {
      onlyIf: request.headers,
      range: wantsRange ? request.headers : undefined,
    });
  } catch {
    // R2 rejects unsatisfiable ranges (e.g. past the end of the file).
    const head = await bucket.head(key);
    if (!head) throw new HttpError(404, 'not_found', 'Media not found');
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${head.size}` },
    });
  }
  if (!object) throw new HttpError(404, 'not_found', 'Media not found');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', cacheControl);

  // Precondition matched (If-None-Match): R2 returns metadata without a body.
  if (!('body' in object)) return new Response(null, { status: 304, headers });

  const window = wantsRange ? resolveRange(object.range, object.size) : null;
  if (window) {
    headers.set(
      'Content-Range',
      `bytes ${window.offset}-${window.offset + window.length - 1}/${object.size}`,
    );
    headers.set('Content-Length', String(window.length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}

/**
 * Streams audio and covers straight from the private R2 bucket. Range
 * support is what makes instant seeking work: the browser only downloads the
 * part of the file it needs. Objects are immutable (keyed by track id), so the
 * browser may cache them for a year.
 */
export const mediaRoutes = new Hono<AppEnv>()
  .get('/audio/:id', (c) =>
    serveObject(
      c.env.BUCKET,
      audioKey(assertId(c.req.param('id'), 'Track')),
      c.req.raw,
      'private, max-age=31536000, immutable',
    ),
  )
  .get('/playlist-cover/:id', (c) =>
    serveObject(
      c.env.BUCKET,
      playlistCoverKey(assertId(c.req.param('id'), 'Playlist')),
      c.req.raw,
      'private, max-age=31536000, immutable',
    ),
  )
  .get('/cover/:id', (c) =>
    serveObject(
      c.env.BUCKET,
      coverKey(assertId(c.req.param('id'), 'Track')),
      c.req.raw,
      'private, max-age=31536000, immutable',
    ),
  );
