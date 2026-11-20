import { describe, expect, it } from 'vitest';
import { createCfApi } from '../../src/cloudflare/api';
import {
  createSubdomain,
  ensureD1,
  ensureR2,
  getSubdomain,
  listAccounts,
  scriptExists,
  verifyToken,
} from '../../src/cloudflare/resources';
import { FakeCloudflare, fail, ok } from './fakeCloudflare';

function setup() {
  const fake = new FakeCloudflare();
  return { fake, api: createCfApi(fake.transport, 'tok') };
}

describe('resources', () => {
  it('verifyToken accepts active and rejects other statuses', async () => {
    const a = setup();
    a.fake.on('GET /user/tokens/verify', ok({ status: 'active' }));
    await expect(verifyToken(a.api)).resolves.toBeUndefined();
    const b = setup();
    b.fake.on('GET /user/tokens/verify', ok({ status: 'expired' }));
    await expect(verifyToken(b.api)).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('listAccounts returns the result', async () => {
    const { fake, api } = setup();
    fake.on('GET /accounts', ok([{ id: 'a1', name: 'Mi cuenta' }]));
    expect(await listAccounts(api)).toEqual([{ id: 'a1', name: 'Mi cuenta' }]);
  });

  it('getSubdomain returns null when missing', async () => {
    const { fake, api } = setup();
    fake.on('GET /accounts/a1/workers/subdomain', fail(404, 10007));
    expect(await getSubdomain(api, 'a1')).toBeNull();
    fake.on('GET /accounts/a1/workers/subdomain', ok({ subdomain: 'andoni' }));
    expect(await getSubdomain(api, 'a1')).toBe('andoni');
  });

  it('createSubdomain validates the name before calling', async () => {
    const { fake, api } = setup();
    for (const bad of ['A', 'ab_c', '-abc', 'abc-', 'x'.repeat(64)]) {
      await expect(createSubdomain(api, 'a1', bad)).rejects.toMatchObject({
        code: 'subdomain_invalid',
      });
    }
    expect(fake.requests).toHaveLength(0);
    fake.on('PUT /accounts/a1/workers/subdomain', ok({ subdomain: 'aske-1234' }));
    expect(await createSubdomain(api, 'a1', 'aske-1234')).toBe('aske-1234');
    expect(fake.req(0).json).toEqual({ subdomain: 'aske-1234' });
  });

  it('scriptExists is false on 404', async () => {
    const { fake, api } = setup();
    const path = 'GET /accounts/a1/workers/scripts/aske-stream/settings';
    fake.on(path, fail(404));
    expect(await scriptExists(api, 'a1')).toBe(false);
    fake.on(path, ok({}));
    expect(await scriptExists(api, 'a1')).toBe(true);
  });

  it('ensureD1 does not recreate an existing database', async () => {
    const { fake, api } = setup();
    fake.on('GET /accounts/a1/d1/database', ok([{ uuid: 'u1', name: 'aske-stream' }]));
    expect(await ensureD1(api, 'a1')).toBe('u1');
    expect(fake.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('ensureD1 creates it when missing', async () => {
    const { fake, api } = setup();
    fake
      .on('GET /accounts/a1/d1/database', ok([]))
      .on('POST /accounts/a1/d1/database', ok({ uuid: 'new' }));
    expect(await ensureD1(api, 'a1')).toBe('new');
    expect(fake.req(1).json).toEqual({ name: 'aske-stream' });
  });

  it('ensureR2 only creates a missing bucket', async () => {
    const a = setup();
    a.fake.on('GET /accounts/a1/r2/buckets/aske-stream-media', ok({ name: 'aske-stream-media' }));
    await ensureR2(a.api, 'a1');
    expect(a.fake.lines()).toEqual(['GET /accounts/a1/r2/buckets/aske-stream-media']);

    const b = setup();
    b.fake.on('GET /accounts/a1/r2/buckets/', fail(404, 10006));
    await ensureR2(b.api, 'a1');
    expect(b.fake.lines()[1]).toBe('POST /accounts/a1/r2/buckets');
    expect(b.fake.req(1).json).toEqual({ name: 'aske-stream-media' });
  });

  it('ensureR2 reports r2_not_enabled', async () => {
    const { fake, api } = setup();
    fake.on('GET /accounts/a1/r2/buckets/', fail(403, 10042));
    await expect(ensureR2(api, 'a1')).rejects.toMatchObject({ code: 'r2_not_enabled' });
  });
});
