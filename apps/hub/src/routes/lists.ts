import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import {
  HUB_LIMITS,
  isListId,
  sanitizeHubSong,
  type CreatedList,
  type HubSong,
  type SharedList,
} from '@aske/shared/hub';
import type { HubAppEnv } from '../env';
import { randomHex, safeEqual, sha256Hex } from '../lib/crypto';
import { HubHttpError } from '../lib/http';
import { randomCode } from '../lib/ids';
import { enforceRateLimit } from '../lib/rateLimit';

const HOUR_MS = 3600 * 1000;
const ID_ATTEMPTS = 5;

const CreateBody = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameMax),
  songs: z.array(z.unknown()),
});

interface ListRow {
  id: string;
  name: string;
  songs_json: string;
  delete_key_hash: string;
  created_at: number;
  expires_at: number;
}

const invalid = (message: string) => new HubHttpError(400, 'invalid_request', message);

async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > HUB_LIMITS.listBodyMaxBytes) {
    throw new HubHttpError(413, 'too_many_songs', 'The list is too big');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw invalid('Body must be valid JSON');
  }
}

function parseList(raw: unknown): { name: string; songs: HubSong[] } {
  const parsed = CreateBody.safeParse(raw);
  if (!parsed.success) throw invalid('name and songs are required');
  const { name, songs: rawSongs } = parsed.data;
  if (rawSongs.length > HUB_LIMITS.listMaxSongs) {
    throw new HubHttpError(413, 'too_many_songs', 'Too many songs in the list');
  }
  if (rawSongs.length === 0) throw invalid('The list has no songs');
  const songs: HubSong[] = [];
  for (const item of rawSongs) {
    const song = sanitizeHubSong(item);
    if (!song) throw invalid('A song is not valid');
    songs.push(song);
  }
  return { name, songs };
}

async function insertList(db: D1Database, row: Omit<ListRow, 'id'>): Promise<string> {
  for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
    const id = randomCode(HUB_LIMITS.listIdLength);
    const result = await db
      .prepare(
        `INSERT INTO shared_lists (id, name, songs_json, delete_key_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
      )
      .bind(id, row.name, row.songs_json, row.delete_key_hash, row.created_at, row.expires_at)
      .run();
    if (result.meta.changes > 0) return id;
  }
  throw new HubHttpError(500, 'internal_error', 'Could not create the list');
}

async function findList(db: D1Database, id: string): Promise<ListRow> {
  const row = isListId(id)
    ? await db.prepare('SELECT * FROM shared_lists WHERE id = ?').bind(id).first<ListRow>()
    : null;
  if (!row) throw new HubHttpError(404, 'not_found', 'List not found');
  return row;
}

export const listRoutes = new Hono<HubAppEnv>();

listRoutes.post('/', async (c) => {
  await enforceRateLimit(c, c.env.DB, 'list', 20, HOUR_MS);
  const { name, songs } = parseList(await readBody(c.req.raw));
  const now = Date.now();
  const deleteKey = randomHex(16);
  const expiresAt = now + HUB_LIMITS.listTtlMs;
  const id = await insertList(c.env.DB, {
    name,
    songs_json: JSON.stringify(songs),
    delete_key_hash: await sha256Hex(deleteKey),
    created_at: now,
    expires_at: expiresAt,
  });
  const created: CreatedList = { id, deleteKey, expiresAt };
  return c.json(created, 201);
});

listRoutes.get('/:id', async (c) => {
  const row = await findList(c.env.DB, c.req.param('id'));
  if (row.expires_at < Date.now()) {
    throw new HubHttpError(410, 'expired', 'This link has expired');
  }
  const list: SharedList = {
    id: row.id,
    name: row.name,
    songs: JSON.parse(row.songs_json) as HubSong[],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
  return c.json(list);
});

listRoutes.delete('/:id', async (c) => {
  const row = await findList(c.env.DB, c.req.param('id'));
  const key = c.req.header('X-Delete-Key') ?? '';
  if (!(await safeEqual(await sha256Hex(key), row.delete_key_hash))) {
    throw new HubHttpError(403, 'invalid_request', 'Wrong delete key');
  }
  await c.env.DB.prepare('DELETE FROM shared_lists WHERE id = ?').bind(row.id).run();
  return c.body(null, 204);
});
