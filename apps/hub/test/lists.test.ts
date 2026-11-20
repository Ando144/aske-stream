import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { HubHttpError } from '../src/lib/http';
import { listRoutes } from '../src/routes/lists';
import { FakeD1 } from './fakeDb';

const song = { videoId: 'dQw4w9WgXcQ', title: 't', artist: 'a' };

function setup() {
  const db = new FakeD1();
  const app = new Hono();
  app.route('/hub/v1/lists', listRoutes);
  app.onError((err, c) =>
    err instanceof HubHttpError
      ? c.json({ error: err.code, message: err.message }, err.status)
      : c.json({ error: 'internal_error' }, 500),
  );
  const call = (path: string, init?: RequestInit) =>
    app.request(`/hub/v1/lists${path}`, init, { DB: db });
  const create = (body: unknown) =>
    call('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { db, call, create };
}

describe('shared lists', () => {
  it('creates a list and returns its delete key', async () => {
    const { create, call, db } = setup();
    const res = await create({ name: 'Gym', songs: [song] });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; deleteKey: string; expiresAt: number };
    expect(created.id).toHaveLength(10);
    expect(created.deleteKey).toMatch(/^[0-9a-f]{32}$/);
    expect(db.lists.get(created.id)?.delete_key_hash).not.toBe(created.deleteKey);

    const got = await call(`/${created.id}`);
    expect(got.status).toBe(200);
    expect(((await got.json()) as { songs: unknown[] }).songs).toEqual([song]);
  });

  it('rejects more than 1000 songs with 413', async () => {
    const { create } = setup();
    const res = await create({ name: 'x', songs: Array.from({ length: 1001 }, () => song) });
    expect(res.status).toBe(413);
  });

  it('rejects a bad videoId with 400', async () => {
    const { create } = setup();
    const res = await create({ name: 'x', songs: [{ ...song, videoId: 'bad' }] });
    expect(res.status).toBe(400);
  });

  it('rejects an empty name or no songs with 400', async () => {
    const { create } = setup();
    expect((await create({ name: ' ', songs: [song] })).status).toBe(400);
    expect((await create({ name: 'x', songs: [] })).status).toBe(400);
  });

  it('answers 410 for an expired list and 404 for an unknown one', async () => {
    const { create, call, db } = setup();
    const created = (await (await create({ name: 'x', songs: [song] })).json()) as { id: string };
    db.lists.get(created.id)!.expires_at = Date.now() - 1;
    expect((await call(`/${created.id}`)).status).toBe(410);
    expect((await call('/ABCDEFGHJK')).status).toBe(404);
    expect((await call('/nope')).status).toBe(404);
  });

  it('deletes only with the right key', async () => {
    const { create, call, db } = setup();
    const created = (await (await create({ name: 'x', songs: [song] })).json()) as {
      id: string;
      deleteKey: string;
    };
    const bad = await call(`/${created.id}`, {
      method: 'DELETE',
      headers: { 'X-Delete-Key': 'no' },
    });
    expect(bad.status).toBe(403);
    expect(db.lists.has(created.id)).toBe(true);
    const ok = await call(`/${created.id}`, {
      method: 'DELETE',
      headers: { 'X-Delete-Key': created.deleteKey },
    });
    expect(ok.status).toBe(204);
    expect(db.lists.has(created.id)).toBe(false);
  });
});
