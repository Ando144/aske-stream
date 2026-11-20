// Packs the Worker, the web build and the D1 migrations into
// apps/web/dist-android/cf-bundle so the Android app can deploy them to the
// user's own Cloudflare account. Needs no Cloudflare login (wrangler --dry-run).
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAssetManifest, readCompatibilityDate, sortMigrations } from './lib/worker-bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps/api');
const webDist = join(root, 'apps/web/dist');
const outDir = join(root, 'apps/web/dist-android/cf-bundle');

function fail(message) {
  console.error(`bundle-worker: ${message}`);
  process.exit(1);
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function removeWithRetry(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

function buildWorker() {
  const tmp = mkdtempSync(join(tmpdir(), 'aske-worker-'));
  try {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    execFileSync(npx, ['wrangler', 'deploy', '--dry-run', '--outdir', tmp], {
      cwd: apiDir,
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
    });
    const built = join(tmp, 'index.js');
    if (!existsSync(built)) fail('wrangler did not produce index.js');
    cpSync(built, join(outDir, 'index.js'));
  } finally {
    removeWithRetry(tmp);
  }
}

function copySite() {
  const site = join(outDir, 'site');
  cpSync(webDist, site, {
    recursive: true,
    filter: (src) => !src.endsWith('.map'),
  });
  return listFiles(site).map((file) => ({
    path: '/' + relative(site, file).split(sep).join('/'),
    content: readFileSync(file),
  }));
}

function readMigrations() {
  const dir = join(apiDir, 'migrations');
  return sortMigrations(readdirSync(dir)).map((name) => ({
    name,
    sql: readFileSync(join(dir, name), 'utf8'),
  }));
}

function main() {
  if (!existsSync(webDist) || !statSync(webDist).isDirectory()) {
    fail('apps/web/dist not found. Run "npm run build -w @aske/web" first.');
  }
  removeWithRetry(outDir);
  mkdirSync(outDir, { recursive: true });
  buildWorker();
  const files = copySite();
  const manifest = {
    version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
    compatibilityDate: readCompatibilityDate(readFileSync(join(apiDir, 'wrangler.jsonc'), 'utf8')),
    mainModule: 'index.js',
    migrations: readMigrations(),
    assets: buildAssetManifest(files),
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest));
  console.log(`cf-bundle ready: ${files.length} files, ${manifest.migrations.length} migrations`);
}

main();
