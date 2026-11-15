#!/usr/bin/env node
/**
 * Local development: Worker (API + local D1/R2) on :8787 and Vite on :5173.
 * Works the same on Windows, macOS and Linux.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const api = join(root, 'apps', 'api');
const dist = join(root, 'apps', 'web', 'dist');
const shell = process.platform === 'win32';

if (!existsSync(join(api, '.dev.vars'))) {
  copyFileSync(join(api, '.dev.vars.example'), join(api, '.dev.vars'));
  console.log('Created apps/api/.dev.vars with a development ACCESS_KEY');
}
// wrangler needs the assets folder to exist even when Vite serves the UI.
if (!existsSync(join(dist, 'index.html'))) {
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    join(dist, 'index.html'),
    '<!doctype html><p>Run the UI at http://localhost:5173</p>',
  );
}

spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'], {
  cwd: api,
  stdio: 'inherit',
  shell,
});

const children = [
  spawn('npx', ['wrangler', 'dev', '--port', '8787'], { cwd: api, stdio: 'inherit', shell }),
  spawn('npm', ['run', 'dev', '-w', '@aske/web'], { cwd: root, stdio: 'inherit', shell }),
];

const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', stop));

console.log('\n  App:  http://localhost:5173/#key=local-dev-access-key-change-me-0123456789\n');
