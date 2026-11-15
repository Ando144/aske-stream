#!/usr/bin/env node
/**
 * One-time setup of YOUR Cloudflare account:
 *   1. creates the D1 database and writes its id into apps/api/wrangler.jsonc
 *   2. creates the R2 bucket
 *   3. applies the database migrations
 *   4. builds and deploys the Worker + PWA
 *   5. generates an ACCESS_KEY, stores it as a Worker secret and in .env
 *
 * Safe to re-run: existing resources are reused and the key is only generated once.
 * Prerequisite: `npx wrangler login` (and R2 enabled once in the dashboard).
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiDir = join(root, 'apps', 'api');
const configPath = join(apiDir, 'wrangler.jsonc');
const envPath = join(root, '.env');
const DB_NAME = 'aske-stream';
const BUCKET = 'aske-stream-media';
const PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000000';
const shell = process.platform === 'win32';

function wrangler(args, { input, inherit = false } = {}) {
  const res = spawnSync('npx', ['wrangler', ...args], {
    cwd: apiDir,
    shell,
    input,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
  });
  return { ok: res.status === 0, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

function step(n, text) {
  console.log(`\n[${n}/5] ${text}`);
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const who = wrangler(['whoami']);
if (!who.ok || /not authenticated/i.test(who.out)) {
  fail('You are not logged in. Run: npx wrangler login');
}

// 1. D1
step(1, `D1 database "${DB_NAME}"`);
let config = readFileSync(configPath, 'utf8');
let dbId = config.match(/"database_id":\s*"([^"]+)"/)?.[1];
if (!dbId || dbId === PLACEHOLDER_ID) {
  const created = wrangler(['d1', 'create', DB_NAME]);
  dbId = created.out.match(/database_id["\s=:]+"?([0-9a-f-]{36})/i)?.[1];
  if (!dbId) {
    const list = wrangler(['d1', 'list', '--json']);
    try {
      dbId = JSON.parse(list.out.slice(list.out.indexOf('['))).find(
        (d) => d.name === DB_NAME,
      )?.uuid;
    } catch {
      // handled below
    }
  }
  if (!dbId) fail(`Could not create or find the D1 database:\n${created.out}`);
  config = config.replace(PLACEHOLDER_ID, dbId);
  writeFileSync(configPath, config);
  console.log(`  ✓ database_id ${dbId} written to apps/api/wrangler.jsonc`);
} else {
  console.log(`  ✓ already configured (${dbId})`);
}

// 2. R2
step(2, `R2 bucket "${BUCKET}"`);
const bucket = wrangler(['r2', 'bucket', 'create', BUCKET]);
if (bucket.ok || /already exists/i.test(bucket.out)) {
  console.log('  ✓ ready');
} else if (/enable R2|10042|purchase/i.test(bucket.out)) {
  fail(
    'R2 is not enabled on your account yet. Open the Cloudflare dashboard → R2, enable it (free tier, payment method required), then re-run.',
  );
} else {
  fail(`Could not create the bucket:\n${bucket.out}`);
}

// 3. Migrations
step(3, 'Database migrations');
if (
  !wrangler(['d1', 'migrations', 'apply', 'DB', '--remote'], { input: 'y\n', inherit: false }).ok
) {
  fail('Migrations failed. Try: npm run db:migrate:remote');
}
console.log('  ✓ applied');

// 4. Build + deploy
step(4, 'Build and deploy');
const build = spawnSync('npm', ['run', 'build'], { cwd: root, shell, stdio: 'inherit' });
if (build.status !== 0) fail('Build failed');
const deploy = wrangler(['deploy']);
if (!deploy.ok) fail(`Deploy failed:\n${deploy.out}`);
const url = deploy.out.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0];
console.log(`  ✓ deployed${url ? ` to ${url}` : ''}`);

// 5. Access key
step(5, 'Access key');
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
let key = env.match(/^ASKE_ACCESS_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  key = randomBytes(32).toString('base64url');
  const secret = wrangler(['secret', 'put', 'ACCESS_KEY'], { input: `${key}\n` });
  if (!secret.ok) fail(`Could not store the secret:\n${secret.out}`);
  console.log('  ✓ new ACCESS_KEY stored as a Worker secret');
} else {
  console.log('  ✓ reusing ASKE_ACCESS_KEY from .env');
}
const setVar = (text, name, value) =>
  new RegExp(`^${name}=`, 'm').test(text)
    ? text.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${value}`)
    : `${text.trimEnd()}\n${name}=${value}\n`.trimStart();
if (url) env = setVar(env, 'ASKE_URL', url);
env = setVar(env, 'ASKE_ACCESS_KEY', key);
writeFileSync(envPath, env);
console.log('  ✓ .env updated (git-ignored)');

console.log(`
Done! Open this link ONCE on each device to pair it (then install the app):

  ${url ?? 'https://<your-worker>.workers.dev'}/#key=${key}

Keep the key private. Add music with:  npm run ingest -- <YouTube link or folder>
`);
