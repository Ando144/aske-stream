#!/usr/bin/env node
/**
 * End-to-end smoke test of the API against a real local Worker
 * (wrangler dev = workerd + local D1 + local R2).
 *
 *   npm run test:e2e                       # spawns its own isolated Worker
 *   node scripts/smoke.mjs --url http://localhost:8787 --key <ACCESS_KEY>
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const apiDir = join(root, 'apps', 'api');
const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

let baseUrl = argValue('--url');
let key = argValue('--key') ?? 'smoke-test-access-key-0123456789';
let child;
let persistDir;
const isWin = process.platform === 'win32';

async function startWorker() {
  persistDir = mkdtempSync(join(tmpdir(), 'aske-smoke-'));
  const distIndex = join(root, 'apps', 'web', 'dist', 'index.html');
  if (!existsSync(distIndex)) {
    mkdirSync(join(root, 'apps', 'web', 'dist'), { recursive: true });
    writeFileSync(distIndex, '<!doctype html><title>placeholder</title>');
  }
  const wrangler = (extra) =>
    spawnSync('npx', ['wrangler', ...extra, '--persist-to', persistDir], {
      cwd: apiDir,
      stdio: 'inherit',
      shell: isWin,
    });
  const migrate = wrangler(['d1', 'migrations', 'apply', 'DB', '--local']);
  if (migrate.status !== 0) throw new Error('Could not apply migrations');

  const port = 8800 + Math.floor(Math.random() * 100);
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '--port',
      String(port),
      '--ip',
      '127.0.0.1',
      '--persist-to',
      persistDir,
      '--var',
      `ACCESS_KEY:${key}`,
      // 2 MB budget so the "storage full" check can be tested with small files.
      '--var',
      'STORAGE_LIMIT_GB:0.002',
      '--show-interactive-dev-session=false',
    ],
    { cwd: apiDir, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin },
  );
  child.stdout.on('data', () => {});
  child.stderr.on('data', (d) => process.env.SMOKE_DEBUG && process.stderr.write(d));

  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
  }
  throw new Error('Worker did not start');
}

async function stopWorker() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((done) => child.once('exit', done));
  // On Windows kill() only ends the cmd.exe shell and leaves wrangler and workerd running.
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill();
  await Promise.race([exited, sleep(5000)]);
}

async function stop() {
  await stopWorker();
  if (!persistDir) return;
  try {
    rmSync(persistDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.warn(`Could not delete the temporary folder ${persistDir}: ${err.message}`);
  }
}

let cookie = '';
async function api(path, init = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set('cookie', cookie);
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(init.json);
  }
  const res = await fetch(baseUrl + path, { ...init, headers });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return res;
}
const json = async (res) => (res.status === 204 ? null : res.json());

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(['ok', name]);
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push(['fail', name]);
    console.log(`  ✗ ${name}\n    ${err.message}`);
  }
}

function fakeOgg(size) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = i % 251;
  bytes.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
  return bytes;
}

async function upload(meta, audio = fakeOgg(64 * 1024), withCover = true) {
  const form = new FormData();
  form.set('meta', JSON.stringify(meta));
  form.set('audio', new Blob([audio], { type: 'audio/ogg' }), 'audio.opus');
  if (withCover) {
    form.set('cover', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])]), 'c.jpg');
  }
  return fetch(`${baseUrl}/api/ingest/tracks`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
}

async function main() {
  if (!baseUrl) await startWorker();
  console.log(`Smoke testing ${baseUrl}\n`);
  const state = {};
  const meta = (n) => ({
    title: `Song ${n}`,
    artist: 'Smoke Test',
    album: 'CI',
    durationMs: 180_000 + n,
    bitrateKbps: 128,
    source: 'youtube',
    sourceRef: `vid${n}-${Date.now()}`,
  });

  await step('health is public', async () => assert.equal((await api('/api/health')).status, 200));
  await step('health returns the Worker version', async () => {
    const health = await json(await api('/api/health'));
    assert.match(health.version, /^\d+\.\d+\.\d+/);
  });
  await step('pairing codes: create, pair once, reject reuse and wrong codes', async () => {
    const pairWith = (code) =>
      fetch(`${baseUrl}/api/auth/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
    const url = `${baseUrl}/api/auth/pairing-codes`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    const made = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${key}` } });
    assert.equal(made.status, 201);
    const { code, expiresAt } = await made.json();
    assert.match(code, /^[2-9A-HJ-NP-Z]{8}$/);
    assert.ok(expiresAt > Date.now());
    const paired = await pairWith(`${code.slice(0, 4)}-${code.slice(4).toLowerCase()}`);
    assert.equal(paired.status, 200, await paired.clone().text());
    assert.match((await paired.json()).token, /^v1\./);
    const again = await pairWith(code);
    assert.equal(again.status, 401);
    assert.equal((await again.json()).error, 'invalid_code');
    assert.equal((await pairWith('ZZZZZZZZ')).status, 401);
  });
  await step('library requires pairing', async () => {
    assert.equal((await api('/api/library')).status, 401);
    assert.equal((await api('/media/audio/AAAAAAAAAAAAAAAA')).status, 401);
  });
  await step('wrong key is rejected', async () => {
    const res = await api('/api/auth/pair', { method: 'POST', json: { key: 'nope' } });
    assert.equal(res.status, 401);
    assert.equal(cookie, '');
  });
  await step('pairing sets an HttpOnly SameSite=Strict cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    assert.equal(res.status, 200);
    const set = res.headers.get('set-cookie') ?? '';
    assert.match(set, /HttpOnly/i);
    assert.match(set, /SameSite=Strict/i);
    cookie = set.split(';')[0];
    assert.deepEqual(await json(await api('/api/auth/status')), { paired: true });
  });

  await step('CLI uploads tracks with the bearer key', async () => {
    state.m1 = meta(1);
    const r1 = await upload(state.m1);
    assert.equal(r1.status, 201, await r1.clone().text());
    state.t1 = await r1.json();
    assert.equal(state.t1.hasCover, true);
    const r2 = await upload(meta(2), fakeOgg(32 * 1024), false);
    assert.equal(r2.status, 201);
    state.t2 = await r2.json();
  });
  await step('duplicates and non-Ogg uploads are rejected', async () => {
    assert.equal((await upload(state.m1)).status, 409);
    const notOgg = await upload(meta(3), new Uint8Array(1024).fill(7));
    assert.equal(notOgg.status, 415);
    const exists = await json(
      await fetch(`${baseUrl}/api/ingest/exists?source=youtube&ref=${state.m1.sourceRef}`, {
        headers: { authorization: `Bearer ${key}` },
      }),
    );
    assert.deepEqual(exists, { exists: true, id: state.t1.id });
  });

  await step('library snapshot + ETag/304', async () => {
    const res = await api('/api/library');
    const lib = await res.json();
    assert.equal(lib.tracks.length, 2);
    const etag = res.headers.get('etag');
    assert.ok(etag);
    assert.equal((await api('/api/library', { headers: { 'if-none-match': etag } })).status, 304);
    state.etag = etag;
  });

  await step('audio streams with HTTP Range (seeking)', async () => {
    const full = await api(`/media/audio/${state.t1.id}`);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('accept-ranges'), 'bytes');
    assert.match(full.headers.get('content-type'), /audio\/ogg/);
    assert.equal((await full.arrayBuffer()).byteLength, 64 * 1024);

    const part = await api(`/media/audio/${state.t1.id}`, { headers: { range: 'bytes=100-199' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), `bytes 100-199/${64 * 1024}`);
    const body = new Uint8Array(await part.arrayBuffer());
    assert.equal(body.length, 100);
    assert.equal(body[0], 100 % 251);

    const tail = await api(`/media/audio/${state.t1.id}`, { headers: { range: 'bytes=-10' } });
    assert.equal(tail.status, 206);
    assert.equal((await tail.arrayBuffer()).byteLength, 10);

    const open = await api(`/media/audio/${state.t1.id}`, { headers: { range: 'bytes=65000-' } });
    assert.equal(open.status, 206);
    assert.equal((await open.arrayBuffer()).byteLength, 64 * 1024 - 65000);

    const cover = await api(`/media/cover/${state.t1.id}`);
    assert.equal(cover.status, 200);
    assert.equal((await api(`/media/cover/${state.t2.id}`)).status, 404);
  });

  await step('like / unlike a song', async () => {
    const liked = await json(
      await api(`/api/tracks/${state.t1.id}`, { method: 'PATCH', json: { liked: true } }),
    );
    assert.ok(liked.likedAt);
    const again = await json(
      await api(`/api/tracks/${state.t1.id}`, { method: 'PATCH', json: { liked: true } }),
    );
    assert.equal(again.likedAt, liked.likedAt, 'liking twice keeps the original timestamp');
    const res = await api('/api/library', { headers: { 'if-none-match': state.etag } });
    assert.equal(res.status, 200, 'writes bump the library version');
  });

  await step('playlists: create, add, reorder, remove, rename, delete', async () => {
    const pl = await json(
      await api('/api/playlists', {
        method: 'POST',
        json: { name: 'Gym', trackIds: [state.t1.id, 'doesNotExist1234'] },
      }),
    );
    assert.deepEqual(pl.trackIds, [state.t1.id]);
    const added = await json(
      await api(`/api/playlists/${pl.id}/tracks`, {
        method: 'POST',
        json: { trackIds: [state.t2.id, state.t1.id] },
      }),
    );
    assert.deepEqual(added.trackIds, [state.t1.id, state.t2.id]);
    const reordered = await json(
      await api(`/api/playlists/${pl.id}/tracks`, {
        method: 'PUT',
        json: { trackIds: [state.t2.id, state.t1.id] },
      }),
    );
    assert.deepEqual(reordered.trackIds, [state.t2.id, state.t1.id]);
    const bad = await api(`/api/playlists/${pl.id}/tracks`, {
      method: 'PUT',
      json: { trackIds: [state.t2.id] },
    });
    assert.equal(bad.status, 400);
    const removed = await json(
      await api(`/api/playlists/${pl.id}/tracks/${state.t2.id}`, { method: 'DELETE' }),
    );
    assert.deepEqual(removed.trackIds, [state.t1.id]);
    const renamed = await json(
      await api(`/api/playlists/${pl.id}`, { method: 'PATCH', json: { name: 'Running' } }),
    );
    assert.equal(renamed.name, 'Running');
    state.playlistId = pl.id;
  });

  await step('folders: create, move a playlist in, list, delete keeps the playlist', async () => {
    const folder = await json(await api('/api/folders', { method: 'POST', json: { name: 'Mix' } }));
    const missing = await api(`/api/playlists/${state.playlistId}`, {
      method: 'PATCH',
      json: { folderId: 'doesNotExist1234' },
    });
    assert.equal(missing.status, 400);
    const moved = await json(
      await api(`/api/playlists/${state.playlistId}`, {
        method: 'PATCH',
        json: { folderId: folder.id },
      }),
    );
    assert.equal(moved.folderId, folder.id);
    const lib = await json(await api('/api/library'));
    assert.ok(lib.folders.some((f) => f.id === folder.id));
    assert.equal(lib.playlists.find((p) => p.id === state.playlistId).folderId, folder.id);
    assert.equal((await api(`/api/folders/${folder.id}`, { method: 'DELETE' })).status, 204);
    const after = await json(await api('/api/library'));
    assert.equal(
      after.folders.some((f) => f.id === folder.id),
      false,
    );
    assert.equal(after.playlists.find((p) => p.id === state.playlistId).folderId, null);
  });

  await step('stations: custom URLs, like/unlike, catalog upsert', async () => {
    const ftp = await api('/api/stations', {
      method: 'POST',
      json: { name: 'Plain', streamUrl: 'ftp://example.com/live' },
    });
    assert.equal(ftp.status, 400);
    const custom = await json(
      await api('/api/stations', {
        method: 'POST',
        json: { name: 'My stream', streamUrl: 'https://example.com/live' },
      }),
    );
    assert.equal(custom.isCustom, true);
    const catalog = {
      rbUuid: '96062a7b-0601-11e8-ae97-52543be04c81',
      name: 'Catalog FM',
      streamUrl: 'https://example.com/fm',
      tags: ['pop', 'rock'],
    };
    const a = await json(await api('/api/stations', { method: 'POST', json: catalog }));
    const b = await json(await api('/api/stations', { method: 'POST', json: catalog }));
    assert.equal(a.id, b.id, 'catalog stations are upserted by uuid');
    assert.equal(a.likedAt, b.likedAt);
    await api(`/api/stations/${custom.id}`, { method: 'PATCH', json: { liked: false } });
    const list = await json(await api('/api/stations'));
    assert.deepEqual(
      list.map((s) => s.name),
      ['Catalog FM', 'My stream'],
      'liked stations come first',
    );
    assert.equal((await api(`/api/stations/${a.id}`, { method: 'DELETE' })).status, 204);
  });

  await step('deleting a track removes media and playlist entries', async () => {
    assert.equal((await api(`/api/tracks/${state.t1.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await api(`/media/audio/${state.t1.id}`)).status, 404);
    const lib = await json(await api('/api/library'));
    assert.equal(lib.tracks.length, 1);
    assert.deepEqual(lib.playlists.find((p) => p.id === state.playlistId).trackIds, []);
  });

  await step('validation errors and unknown routes return JSON', async () => {
    const res = await api('/api/playlists', { method: 'POST', json: { name: '' } });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'validation_error');
    assert.equal((await api('/api/nope')).status, 404);
    assert.equal((await api('/media/audio/not..valid')).status, 404);
  });

  await step(
    'device tokens: Bearer for the API, ?t= for media, CORS for the app origin',
    async () => {
      const pair = await (
        await fetch(`${baseUrl}/api/auth/pair`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key }),
        })
      ).json();
      assert.match(pair.token, /^v1\./);
      const auth = { authorization: `Bearer ${pair.token}` };
      assert.equal((await fetch(`${baseUrl}/api/library`, { headers: auth })).status, 200);
      assert.equal(
        (await fetch(`${baseUrl}/api/library`, { headers: { authorization: 'Bearer v1.1.bad' } }))
          .status,
        401,
      );
      const media = await fetch(
        `${baseUrl}/media/audio/${state.t2.id}?t=${encodeURIComponent(pair.token)}`,
      );
      assert.equal(media.status, 200);
      assert.equal(
        (await fetch(`${baseUrl}/api/library?t=${pair.token}`)).status,
        401,
        'query tokens only for media',
      );
      const preflight = await fetch(`${baseUrl}/api/library`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://localhost',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      });
      assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://localhost');
      const evil = await fetch(`${baseUrl}/api/library`, {
        headers: { ...auth, origin: 'https://evil.example' },
      });
      assert.equal(evil.headers.get('access-control-allow-origin'), null);
    },
  );

  await step('WebM Opus uploads (downloaded on the phone) are accepted as-is', async () => {
    const webm = fakeOgg(16 * 1024);
    webm.set([0x1a, 0x45, 0xdf, 0xa3], 0);
    const res = await upload(meta(9), webm, false);
    assert.equal(res.status, 201, await res.clone().text());
    const track = await res.json();
    const audio = await fetch(`${baseUrl}/media/audio/${track.id}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    assert.match(audio.headers.get('content-type'), /audio\/webm/);
  });

  await step('playlist covers: JPEG only, served, removable', async () => {
    const put = (bytes) => {
      const form = new FormData();
      form.set('cover', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), 'c.jpg');
      return api(`/api/playlists/${state.playlistId}/cover`, { method: 'PUT', body: form });
    };
    const ok = await put([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    assert.equal(ok.status, 200, await ok.clone().text());
    assert.equal(typeof (await ok.json()).coverAt, 'number');
    const png = await put([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
    assert.equal(png.status, 415);
    assert.equal((await png.json()).error, 'unsupported_cover');
    const img = await api(`/media/playlist-cover/${state.playlistId}`);
    assert.equal(img.status, 200);
    assert.match(img.headers.get('content-type'), /image\/jpeg/);
    const del = await api(`/api/playlists/${state.playlistId}/cover`, { method: 'DELETE' });
    assert.equal((await json(del)).coverAt, null);
    assert.equal((await api(`/media/playlist-cover/${state.playlistId}`)).status, 404);
  });

  await step('folder order: positions, reorder, ignore unknown ids, validation', async () => {
    const make = async (name) =>
      json(await api('/api/folders', { method: 'POST', json: { name } }));
    const [a, b, c] = [await make('A'), await make('B'), await make('C')];
    assert.deepEqual([a.position, b.position, c.position], [0, 1, 2]);
    const names = async () => (await json(await api('/api/library'))).folders.map((f) => f.name);
    assert.deepEqual(await names(), ['A', 'B', 'C']);
    const res = await api('/api/folders/order', {
      method: 'PUT',
      json: { ids: [c.id, a.id, 'doesNotExist1234'] },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(
      (await res.json()).map((f) => f.name),
      ['C', 'A', 'B'],
    );
    assert.deepEqual(await names(), ['C', 'A', 'B']);
    const bad = await api('/api/folders/order', { method: 'PUT', json: { ids: 'nope' } });
    assert.equal(bad.status, 400);
    for (const f of [a, b, c]) {
      assert.equal((await api(`/api/folders/${f.id}`, { method: 'DELETE' })).status, 204);
    }
  });

  await step('canceled uploads: delete own track, block late arrival', async () => {
    const cancel = (id) => api(`/api/ingest/uploads/${id}`, { method: 'DELETE' });
    const trackIds = async () => (await json(await api('/api/library'))).tracks.map((t) => t.id);
    const small = fakeOgg(1024);
    const own = { ...meta(20), uploadId: 'smoke-up-1' };

    const created = await upload(own, small);
    assert.equal(created.status, 201, await created.clone().text());
    const { id } = await created.json();
    const canceled = await cancel('smoke-up-1');
    assert.equal(canceled.status, 200, await canceled.clone().text());
    assert.deepEqual(await canceled.json(), { deletedIds: [id] });
    const remaining = await trackIds();
    assert.equal(remaining.includes(id), false);
    assert.ok(remaining.includes(state.t2.id), 'other songs stay');
    assert.equal((await api(`/media/audio/${id}`)).status, 404);
    assert.equal((await api(`/media/cover/${id}`)).status, 404);

    const usage = async () => json(await api('/api/library/storage'));
    const before = await usage();
    const late = await upload(own, small);
    assert.equal(late.status, 410, await late.clone().text());
    assert.equal((await late.json()).error, 'upload_canceled');
    assert.deepEqual(await trackIds(), remaining);
    assert.deepEqual(await usage(), before);

    const sameSong = { ...meta(21), sourceRef: state.t2.sourceRef, uploadId: 'smoke-up-2' };
    assert.equal((await upload(sameSong, small)).status, 409);
    for (const unknown of ['smoke-up-2', 'smoke-up-never-sent']) {
      assert.deepEqual(await json(await cancel(unknown)), { deletedIds: [] });
    }
    assert.deepEqual(await trackIds(), remaining);
    assert.equal((await api(`/media/audio/${state.t2.id}`)).status, 200);

    assert.equal((await cancel('bad%20id')).status, 400);
    assert.equal((await upload({ ...meta(22), uploadId: 'a/b' }, small)).status, 400);
  });

  await step('storage stats and the free-tier budget', async () => {
    const stats = await json(await api('/api/library/storage'));
    assert.equal(stats.limitBytes, 2_000_000);
    assert.ok(stats.usedBytes > 0 && stats.trackCount > 0, JSON.stringify(stats));
    const big = await upload(meta(10), fakeOgg(2_100_000), false);
    assert.equal(big.status, 507, await big.clone().text());
    assert.equal((await big.json()).error, 'storage_full');
  });

  await step('send to phone: queue, claim, finish, validation', async () => {
    const send = (body) => api('/api/send', { method: 'POST', body: JSON.stringify(body) });
    const song = await send({
      url: 'https://music.youtube.com/watch?v=abcdefghijk&list=PLxyz12345678',
    });
    assert.equal(song.status, 201);
    assert.equal((await json(song)).kind, 'video', 'a song opened inside a playlist is the song');
    const list = await json(
      await send({ url: 'https://www.youtube.com/playlist?list=PLabcdefghij' }),
    );
    assert.equal(list.kind, 'playlist');
    assert.equal((await send({ url: 'https://example.com/watch?v=abcdefghijk' })).status, 400);
    const pending = (await json(await api('/api/send'))).filter((i) => i.status === 'pending');
    assert.equal(pending.length, 2);
    const done = await json(
      await api(`/api/send/${list.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done', detail: '12 songs' }),
      }),
    );
    assert.equal(done.status, 'done');
    assert.equal((await api(`/api/send/${list.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await api('/api/send/nope-nope-nope', { method: 'DELETE' })).status, 404);
  });

  await step('logout clears the session', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    assert.deepEqual(await json(await api('/api/auth/status')), { paired: false });
  });

  const failed = results.filter(([s]) => s === 'fail').length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  return failed;
}

process.on('SIGINT', async () => {
  await stop();
  process.exit(130);
});

main()
  .then(async (failed) => {
    await stop();
    process.exit(failed ? 1 : 0);
  })
  .catch(async (err) => {
    console.error(err);
    await stop();
    process.exit(1);
  });
