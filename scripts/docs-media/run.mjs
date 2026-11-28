#!/usr/bin/env node
/**
 * Regenerates every picture in docs/media: `npm run docs:media` (see README.md here).
 *
 * Builds the web app, starts an isolated local Worker, fills it with invented music, drives it
 * with Playwright (capture.py) and turns the recorded videos into GIFs. The normal build of
 * apps/web/dist is restored at the end, whatever happens.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import * as catalog from './catalog.mjs';

const here = import.meta.dirname;
const root = resolve(here, '..', '..');
const apiDir = join(root, 'apps', 'api');
const mediaDir = join(root, 'docs', 'media');
const wranglerBin = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const isWin = process.platform === 'win32';
const AUDIO_KBPS = 16;
const MAX_GIF_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

/** Resolves when the command succeeds; its output goes to this console. */
function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    child.once('error', fail);
    child.once('exit', (code) => {
      if (code === 0) done();
      else fail(new Error(`"${command} ${args.join(' ')}" failed (exit ${code})`));
    });
  });
}

const ffmpeg = (args) => run('ffmpeg', ['-y', '-loglevel', 'error', ...args]);

function succeeds(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

function findPython() {
  const candidates = process.env.PYTHON
    ? [[process.env.PYTHON]]
    : [['python'], ['python3'], ['py', '-3']];
  const found = candidates.find(([cmd, ...pre]) =>
    succeeds(cmd, [...pre, '-c', 'import playwright']),
  );
  if (found) return found;
  throw new Error(
    'Python with Playwright was not found. Run "pip install playwright" and ' +
      '"python -m playwright install chromium ffmpeg", or set PYTHON to that interpreter.',
  );
}

function checkTools() {
  if (!succeeds('ffmpeg', ['-version'])) {
    throw new Error('ffmpeg was not found. Install it and make sure it is on the PATH.');
  }
  return findPython();
}

/** A gradient with a few translucent bars, so that every picture is different. */
function picture(file, [from, to], seed, width = 600, height = 600) {
  const bars = [0, 1, 2, 3].map((i) => {
    const tall = Math.round(height * (0.18 + (((seed * 7 + i * 5) % 9) / 9) * 0.5));
    const wide = Math.round(width * 0.09);
    const x = Math.round(width * (0.2 + i * 0.17));
    const y = Math.round((height - tall) / 2);
    return `drawbox=x=${x}:y=${y}:w=${wide}:h=${tall}:color=white@0.16:t=fill`;
  });
  const slant = (seed % 3) * Math.round(width / 2);
  const source =
    `gradients=s=${width}x${height}:c0=0x${from}:c1=0x${to}:n=2` +
    // Without a fixed seed the same options give a different picture on every run.
    `:x0=${slant}:y0=0:x1=${width - slant}:y1=${height}:d=1:speed=0.00001:seed=${seed + 1}`;
  return ffmpeg([
    ...['-f', 'lavfi', '-i', source],
    ...['-vf', bars.join(','), '-frames:v', '1', '-q:v', '3', file],
  ]);
}

/** A soft two-note tone, as long as the song claims to be. */
function tone(file, seconds, seed) {
  const base = 180 + seed * 17;
  const source = `aevalsrc=0.08*sin(2*PI*${base}*t)+0.05*sin(2*PI*${base * 1.5}*t):d=${seconds}`;
  return ffmpeg([
    ...['-f', 'lavfi', '-i', source],
    ...['-c:a', 'libopus', '-b:a', `${AUDIO_KBPS}k`, file],
  ]);
}

/** Pictures and data that capture.py serves in place of anything from the internet. */
async function makeAssets(dir) {
  console.log('Generating invented music and pictures...');
  for (const [i, song] of catalog.songs.entries()) {
    await tone(join(dir, `song-${i}.opus`), song.seconds, i);
    await picture(join(dir, `cover-${i}.jpg`), song.art, i);
  }
  for (const [i, station] of catalog.stations.entries()) {
    await picture(join(dir, `logo-${i + 1}.jpg`), station.art, i + 3, 128, 128);
  }
  for (const [i, video] of catalog.videoResults.entries()) {
    await picture(join(dir, `thumb-${i}.jpg`), video.art, i + 5, 480, 270);
  }
  const data = {
    stations: catalog.stations.map(({ art: _art, ...station }) => station),
    tags: catalog.radioTags.map((name, i) => ({ name, stationCount: 40 - i * 4 })),
    countries: catalog.radioCountries,
    videos: catalog.videoResults.map(({ title, author }) => ({ title, author })),
  };
  await writeFile(join(dir, 'data.json'), JSON.stringify(data));
}

function buildWeb(extra = []) {
  const npm = process.env.npm_execpath;
  const args = ['run', 'build', '-w', '@aske/web', ...extra];
  if (npm) return run(process.execPath, [npm, ...args]);
  return run('npm', args, { shell: isWin });
}

const buildFakeNative = () => buildWeb(['--', '--mode', 'fakenative']);

function freePort() {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

function migrate(persistDir) {
  const args = ['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persistDir];
  return run(process.execPath, [wranglerBin, ...args], {
    cwd: apiDir,
    env: { ...process.env, CI: 'true' },
  });
}

async function startWorker(persistDir, key) {
  const port = await freePort();
  const args = [
    ...[wranglerBin, 'dev', '--port', String(port), '--ip', '127.0.0.1'],
    ...['--persist-to', persistDir, '--var', `ACCESS_KEY:${key}`],
    '--show-interactive-dev-session=false',
  ];
  const child = spawn(process.execPath, args, { cwd: apiDir, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  const keep = (chunk) => (log = (log + chunk).slice(-4000));
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120 && child.exitCode === null; i++) {
    await sleep(500);
    const up = await fetch(`${url}/api/health`).then(
      (res) => res.ok,
      () => false, // not listening yet
    );
    if (up) return { child, url };
  }
  await stopWorker({ child });
  throw new Error(`The local Worker did not start:\n${log}`);
}

async function stopWorker(worker) {
  const child = worker?.child;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((done) => child.once('exit', done));
  // On Windows kill() leaves workerd running: the whole process tree has to go.
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill();
  await Promise.race([exited, sleep(5000)]);
}

function apiClient(url, key) {
  return async (path, { json, ...init } = {}) => {
    const headers = { authorization: `Bearer ${key}` };
    if (json !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(json);
    }
    const res = await fetch(url + path, { ...init, headers });
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status}`);
    return res.status === 204 ? null : res.json();
  };
}

async function uploadSong(api, assets, song, i) {
  const form = new FormData();
  const meta = {
    title: song.title,
    artist: song.artist,
    album: song.album,
    durationMs: song.seconds * 1000,
    bitrateKbps: AUDIO_KBPS,
    source: 'file',
    sourceRef: `docs-media-${i}`,
  };
  form.set('meta', JSON.stringify(meta));
  const audio = await readFile(join(assets, `song-${i}.opus`));
  form.set('audio', new Blob([audio], { type: 'audio/ogg' }), 'audio.opus');
  const cover = await readFile(join(assets, `cover-${i}.jpg`));
  form.set('cover', new Blob([cover], { type: 'image/jpeg' }), 'cover.jpg');
  const track = await api('/api/ingest/tracks', { method: 'POST', body: form });
  return track.id;
}

async function seed(url, key, assets) {
  console.log('Filling the local library...');
  const api = apiClient(url, key);
  const ids = [];
  for (const [i, song] of catalog.songs.entries()) {
    ids.push(await uploadSong(api, assets, song, i));
  }
  for (const i of catalog.likedSongs) {
    await api(`/api/tracks/${ids[i]}`, { method: 'PATCH', json: { liked: true } });
  }
  for (const { name, songs } of catalog.playlists) {
    const trackIds = songs.map((i) => ids[i]);
    await api('/api/playlists', { method: 'POST', json: { name, trackIds } });
  }
  for (const i of catalog.savedStations) {
    const { art: _art, votes: _votes, clickCount: _clicks, ...station } = catalog.stations[i];
    await api('/api/stations', { method: 'POST', json: { ...station, liked: true } });
  }
}

function capture(python, mode, context) {
  console.log(`Capturing (${mode})...`);
  const [command, ...prefix] = python;
  return run(command, [...prefix, join(here, 'capture.py')], {
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
      BASE: context.url,
      ACCESS_KEY: context.key,
      MODE: mode,
      OUT: mediaDir,
      ASSETS: context.assets,
      VIDEOS: context.videos,
    },
  });
}

/** capture.py leaves <name>.webm and <name>.json ({start, duration} in seconds). */
async function makeGifs(videos) {
  const filter =
    'fps=15,scale=390:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];' +
    '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle';
  await mkdir(join(mediaDir, 'gifs'), { recursive: true });
  for (const name of ['start', 'player']) {
    const cut = JSON.parse(await readFile(join(videos, `${name}.json`), 'utf8'));
    await ffmpeg([
      ...['-ss', String(cut.start), '-t', String(cut.duration)],
      ...['-i', join(videos, `${name}.webm`), '-vf', filter, '-loop', '0'],
      join(mediaDir, 'gifs', `${name}.gif`),
    ]);
  }
}

async function checkSizes() {
  let total = 0;
  const entries = await readdir(mediaDir, { recursive: true, withFileTypes: true });
  for (const entry of entries.filter((e) => e.isFile())) {
    const file = join(entry.parentPath, entry.name);
    const { size } = await stat(file);
    total += size;
    if (file.endsWith('.gif') && size > MAX_GIF_BYTES) throw new Error(`${file} is over 3 MB`);
  }
  console.log(`docs/media: ${(total / 1024 / 1024).toFixed(2)} MB`);
  if (total > MAX_TOTAL_BYTES) throw new Error('docs/media is over 8 MB');
}

async function generate(python, work, state) {
  const context = {
    key: randomBytes(24).toString('hex'),
    assets: join(work, 'assets'),
    videos: join(work, 'videos'),
  };
  const persist = join(work, 'worker');
  for (const dir of [context.assets, context.videos, persist]) await mkdir(dir);
  await makeAssets(context.assets);
  await buildWeb();
  await migrate(persist);
  state.worker = await startWorker(persist, context.key);
  await seed(state.worker.url, context.key, context.assets);
  await capture(python, 'web', { ...context, url: state.worker.url });
  await stopWorker(state.worker);
  await buildFakeNative();
  state.worker = await startWorker(persist, context.key);
  await capture(python, 'native', { ...context, url: state.worker.url });
  await makeGifs(context.videos);
  await checkSizes();
}

async function cleanUp(work, state) {
  await stopWorker(state.worker);
  try {
    console.log('Restoring the normal web build...');
    await buildWeb();
  } finally {
    await rm(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function main() {
  const python = checkTools();
  if (!existsSync(wranglerBin)) throw new Error('Dependencies are missing: run "npm ci" first.');
  const work = await mkdtemp(join(tmpdir(), 'aske-docs-media-'));
  const state = {};
  // Ctrl+C also reaches the running child, whose failure leads to the clean up below.
  process.on('SIGINT', () => console.warn('Interrupted: cleaning up...'));
  try {
    await generate(python, work, state);
  } finally {
    await cleanUp(work, state);
  }
  console.log('Done: docs/media is up to date.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
