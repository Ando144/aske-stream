import { describe, expect, it } from 'vitest';
import { createCfApi } from '../../src/cloudflare/api';
import {
  enableWorkersDev,
  uploadAssets,
  uploadScript,
  workerUrl,
} from '../../src/cloudflare/deploy';
import type { WorkerBundleManifest } from '../../src/cloudflare/types';
import { FakeCloudflare, ok } from './fakeCloudflare';

const manifest: WorkerBundleManifest = {
  version: '0.6.0',
  compatibilityDate: '2025-01-01',
  mainModule: 'index.js',
  migrations: [],
  assets: {
    '/index.html': { hash: 'h1', size: 10 },
    '/assets/app.js': { hash: 'h2', size: 20 },
    '/assets/app.css': { hash: 'h3', size: 5 },
  },
};

describe('uploadAssets', () => {
  it('opens a session, uploads each bucket with the session jwt and returns the last jwt', async () => {
    const fake = new FakeCloudflare()
      .on(
        'POST /accounts/a1/workers/scripts/aske-stream/assets-upload-session',
        ok({
          jwt: 'session',
          buckets: [['h1', 'h2'], ['h3']],
        }),
      )
      .on('POST /accounts/a1/workers/assets/upload', (req) =>
        ok(req.form!.length === 1 ? { jwt: 'final' } : null, 200),
      );
    const progress: number[] = [];
    const jwt = await uploadAssets(
      createCfApi(fake.transport, 'api-token'),
      'a1',
      manifest,
      async (p) => `b64:${p}`,
      (d) => progress.push(d),
    );
    expect(jwt).toBe('final');
    expect(progress).toEqual([2, 3]);
    expect(fake.req(0).json).toEqual({ manifest: manifest.assets });
    expect(fake.req(0).bearer).toBe('api-token');
    const up = fake.req(1);
    expect(up.path).toBe('/accounts/a1/workers/assets/upload?base64=true');
    expect(up.bearer).toBe('session');
    expect(up.form).toEqual([
      { name: 'h1', value: 'b64:/index.html', filename: 'h1', contentType: 'text/html' },
      {
        name: 'h2',
        value: 'b64:/assets/app.js',
        filename: 'h2',
        contentType: 'application/javascript',
      },
    ]);
    expect(fake.req(2).bearer).toBe('session');
  });

  it('returns the session jwt when nothing needs uploading', async () => {
    const fake = new FakeCloudflare().on(
      'POST /accounts/a1/workers/scripts',
      ok({ jwt: 'session' }),
    );
    const jwt = await uploadAssets(
      createCfApi(fake.transport, 't'),
      'a1',
      manifest,
      async () => '',
    );
    expect(jwt).toBe('session');
    expect(fake.requests).toHaveLength(1);
  });
});

describe('uploadScript', () => {
  async function run(accessKey?: string) {
    const fake = new FakeCloudflare();
    await uploadScript(createCfApi(fake.transport, 't'), 'a1', {
      code: 'export default {}',
      manifest,
      assetsJwt: 'jwt',
      d1Id: 'db-uuid',
      accessKey,
    });
    const req = fake.req(0);
    const metadata = JSON.parse(req.form![0]!.value) as Record<string, unknown>;
    return { req, metadata };
  }

  it('sends metadata and the module with the exact shape (new setup)', async () => {
    const { req, metadata } = await run('KEY');
    expect(req.method).toBe('PUT');
    expect(req.path).toBe('/accounts/a1/workers/scripts/aske-stream');
    expect(req.form).toHaveLength(2);
    expect(req.form![0]).toMatchObject({ name: 'metadata', contentType: 'application/json' });
    expect(req.form![1]).toEqual({
      name: 'index.js',
      value: 'export default {}',
      filename: 'index.js',
      contentType: 'application/javascript+module',
    });
    expect(metadata).toEqual({
      main_module: 'index.js',
      compatibility_date: '2025-01-01',
      bindings: [
        { type: 'd1', name: 'DB', id: 'db-uuid' },
        { type: 'r2_bucket', name: 'BUCKET', bucket_name: 'aske-stream-media' },
        { type: 'assets', name: 'ASSETS' },
        { type: 'secret_text', name: 'ACCESS_KEY', text: 'KEY' },
      ],
      assets: {
        jwt: 'jwt',
        config: {
          not_found_handling: 'single-page-application',
          run_worker_first: ['/api/*', '/media/*'],
        },
      },
      observability: { enabled: true },
    });
  });

  it('keeps existing secrets when there is no accessKey (update)', async () => {
    const { metadata } = await run();
    expect(metadata.keep_bindings).toEqual(['secret_text', 'plain_text']);
    expect(JSON.stringify(metadata)).not.toContain('ACCESS_KEY');
  });
});

describe('workers.dev', () => {
  it('enables the subdomain without previews', async () => {
    const fake = new FakeCloudflare();
    await enableWorkersDev(createCfApi(fake.transport, 't'), 'a1');
    expect(fake.lines()).toEqual(['POST /accounts/a1/workers/scripts/aske-stream/subdomain']);
    expect(fake.req(0).json).toEqual({ enabled: true, previews_enabled: false });
  });

  it('builds the worker url', () => {
    expect(workerUrl('andoni')).toBe('https://aske-stream.andoni.workers.dev');
  });
});
