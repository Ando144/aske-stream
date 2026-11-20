import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  assetHash,
  buildAssetManifest,
  readCompatibilityDate,
  sortMigrations,
} from './worker-bundle.mjs';

test('assetHash hashes base64 content plus extension, 32 hex chars', () => {
  const buf = Buffer.from('hello');
  const expected = createHash('sha256')
    .update(buf.toString('base64') + 'js')
    .digest('hex')
    .slice(0, 32);
  assert.equal(assetHash(buf, '/assets/x.js'), expected);
  assert.match(assetHash(buf, '/index.html'), /^[0-9a-f]{32}$/);
});

test('assetHash depends on the extension', () => {
  const buf = Buffer.from('same');
  assert.notEqual(assetHash(buf, '/a.js'), assetHash(buf, '/a.css'));
});

test('buildAssetManifest keys by path with hash and size', () => {
  const m = buildAssetManifest([
    { path: '/index.html', content: Buffer.from('<html>') },
    { path: '/assets/x.js', content: Buffer.from('abc') },
  ]);
  assert.deepEqual(Object.keys(m).sort(), ['/assets/x.js', '/index.html']);
  assert.equal(m['/index.html'].size, 6);
  assert.match(m['/assets/x.js'].hash, /^[0-9a-f]{32}$/);
});

test('readCompatibilityDate ignores comments and trailing commas', () => {
  const text = `// c
  {
    /* block */
    "main": "src/index.ts", // "compatibility_date": "1999-01-01"
    "url": "https://x.dev/a",
    "compatibility_date": "2026-10-01",
  }`;
  assert.equal(readCompatibilityDate(text), '2026-10-01');
});

test('readCompatibilityDate throws when missing', () => {
  assert.throws(() => readCompatibilityDate('{ "name": "x" }'), /compatibility_date/);
});

test('sortMigrations keeps only .sql and sorts by name', () => {
  assert.deepEqual(sortMigrations(['0002_b.sql', 'README.md', '0001_a.sql', '0010_c.sql']), [
    '0001_a.sql',
    '0002_b.sql',
    '0010_c.sql',
  ]);
});
