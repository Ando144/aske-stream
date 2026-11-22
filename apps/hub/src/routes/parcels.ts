import { Hono } from 'hono';
import { z } from 'zod';
import {
  HUB_LIMITS,
  normalizeParcelCode,
  sanitizeHubSong,
  sanitizeParcelName,
  type ClaimedParcel,
  type CreatedParcel,
  type HubSong,
  type ParcelStatus,
} from '@aske/shared/hub';
import type { HubAppEnv } from '../env';
import { randomHex, safeEqual, sha256Hex } from '../lib/crypto';
import { HubHttpError } from '../lib/http';
import { randomCode } from '../lib/ids';
import { enforceRateLimit } from '../lib/rateLimit';

const HOUR_MS = 3600 * 1000;
const CODE_ATTEMPTS = 5;

const CreateBody = z.object({
  songs: z.array(z.unknown()),
  name: z.unknown().optional(),
  unavailable: z.number().int().min(0).max(100000).default(0),
});

interface ParcelRow {
  code: string;
  songs_json: string;
  sender_key_hash: string;
  created_at: number;
  expires_at: number;
  name: string;
  unavailable: number;
}

const invalid = (message: string) => new HubHttpError(400, 'invalid_request', message);
const notFound = () => new HubHttpError(404, 'not_found', 'Parcel not found');
const expired = () => new HubHttpError(410, 'expired', 'This parcel has expired');

async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > HUB_LIMITS.parcelBodyMaxBytes) {
    throw new HubHttpError(413, 'too_many_songs', 'The parcel is too big');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw invalid('Body must be valid JSON');
  }
}

function parseParcel(raw: unknown): { songs: HubSong[]; name: string; unavailable: number } {
  const parsed = CreateBody.safeParse(raw);
  if (!parsed.success) throw invalid('songs are required');
  return {
    songs: parseSongs(parsed.data.songs),
    name: sanitizeParcelName(parsed.data.name),
    unavailable: parsed.data.unavailable,
  };
}

function parseSongs(rawSongs: unknown[]): HubSong[] {
  if (rawSongs.length > HUB_LIMITS.parcelMaxSongs) {
    throw new HubHttpError(413, 'too_many_songs', 'Too many songs in the parcel');
  }
  if (rawSongs.length === 0) throw invalid('The parcel has no songs');
  const byId = new Map<string, HubSong>();
  for (const item of rawSongs) {
    const song = sanitizeHubSong(item);
    if (!song) throw invalid('A song is not valid');
    if (!byId.has(song.videoId)) byId.set(song.videoId, song);
  }
  return [...byId.values()];
}

async function insertParcel(db: D1Database, row: Omit<ParcelRow, 'code'>): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = randomCode(HUB_LIMITS.parcelCodeLength);
    const result = await db
      .prepare(
        `INSERT INTO parcels (code, songs_json, sender_key_hash, created_at, expires_at, name, unavailable)
         VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING`,
      )
      .bind(
        code,
        row.songs_json,
        row.sender_key_hash,
        row.created_at,
        row.expires_at,
        row.name,
        row.unavailable,
      )
      .run();
    if (result.meta.changes > 0) return code;
  }
  throw new HubHttpError(500, 'internal_error', 'Could not create the parcel');
}

async function findParcel(db: D1Database, rawCode: string): Promise<ParcelRow> {
  const code = normalizeParcelCode(rawCode);
  const row = code
    ? await db.prepare('SELECT * FROM parcels WHERE code = ?').bind(code).first<ParcelRow>()
    : null;
  if (!row) throw notFound();
  return row;
}

async function keyMatches(row: ParcelRow, key: string): Promise<boolean> {
  return safeEqual(await sha256Hex(key), row.sender_key_hash);
}

async function dropParcel(db: D1Database, code: string): Promise<void> {
  await db.prepare('DELETE FROM parcels WHERE code = ?').bind(code).run();
}

export const parcelRoutes = new Hono<HubAppEnv>();

parcelRoutes.post('/', async (c) => {
  await enforceRateLimit(c, c.env.DB, 'parcel', 30, HOUR_MS);
  const { songs, name, unavailable } = parseParcel(await readBody(c.req.raw));
  const now = Date.now();
  const senderKey = randomHex(16);
  const expiresAt = now + HUB_LIMITS.parcelTtlMs;
  const code = await insertParcel(c.env.DB, {
    songs_json: JSON.stringify(songs),
    sender_key_hash: await sha256Hex(senderKey),
    created_at: now,
    expires_at: expiresAt,
    name,
    unavailable,
  });
  const created: CreatedParcel = { code, senderKey, expiresAt, count: songs.length };
  return c.json(created, 201);
});

type RateContext = Parameters<typeof enforceRateLimit>[0];

// Claim and delete share a strict bucket so codes cannot be guessed through them.
const limitParcelLookup = (c: RateContext) =>
  enforceRateLimit(c, c.env.DB, 'parcel-claim', 20, 10 * 60 * 1000);

// The sender polls the status every 4 s (150 per 10 min), so it needs a looser bucket. The
// status also requires the secret sender key, so guessing codes through it is pointless.
const limitParcelStatus = (c: RateContext) =>
  enforceRateLimit(c, c.env.DB, 'parcel-status', 300, 10 * 60 * 1000);

parcelRoutes.get('/:code', async (c) => {
  await limitParcelStatus(c);
  const row = await findParcel(c.env.DB, c.req.param('code'));
  if (!(await keyMatches(row, c.req.header('X-Delete-Key') ?? ''))) throw notFound();
  if (row.expires_at < Date.now()) {
    await dropParcel(c.env.DB, row.code);
    throw expired();
  }
  const status: ParcelStatus = {
    code: row.code,
    count: (JSON.parse(row.songs_json) as HubSong[]).length,
    expiresAt: row.expires_at,
  };
  return c.json(status);
});

parcelRoutes.post('/:code/claim', async (c) => {
  await limitParcelLookup(c);
  const code = normalizeParcelCode(c.req.param('code'));
  const row = code
    ? await c.env.DB.prepare(
        'DELETE FROM parcels WHERE code = ? RETURNING songs_json, expires_at, name, unavailable',
      )
        .bind(code)
        .first<Pick<ParcelRow, 'songs_json' | 'expires_at' | 'name' | 'unavailable'>>()
    : null;
  if (!row) throw notFound();
  if (row.expires_at < Date.now()) throw expired();
  const claimed: ClaimedParcel = {
    songs: JSON.parse(row.songs_json) as HubSong[],
    name: row.name,
    unavailable: row.unavailable,
  };
  return c.json(claimed);
});

parcelRoutes.delete('/:code', async (c) => {
  await limitParcelLookup(c);
  const row = await findParcel(c.env.DB, c.req.param('code'));
  if (!(await keyMatches(row, c.req.header('X-Delete-Key') ?? ''))) {
    throw new HubHttpError(403, 'invalid_request', 'Wrong sender key');
  }
  await dropParcel(c.env.DB, row.code);
  return c.body(null, 204);
});
