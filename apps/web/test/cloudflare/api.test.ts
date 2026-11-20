import { describe, expect, it } from 'vitest';
import { createCfApi } from '../../src/cloudflare/api';
import { CfError, TOKEN_CREATE_URL, type CfErrorCode } from '../../src/cloudflare/types';
import { FakeCloudflare, fail, ok } from './fakeCloudflare';

const TOKEN = 'secret-token-1234567890-abcdefghijkl';

async function codeOf(res: ReturnType<typeof fail>): Promise<CfError> {
  const fake = new FakeCloudflare().on('GET /x', res);
  const err = await createCfApi(fake.transport, TOKEN)
    .call('GET', '/x')
    .catch((e) => e);
  expect(err).toBeInstanceOf(CfError);
  return err as CfError;
}

describe('createCfApi', () => {
  it('unwraps result and sends the token as bearer', async () => {
    const fake = new FakeCloudflare().on('GET /x', ok({ a: 1 }));
    const r = await createCfApi(fake.transport, TOKEN).call('GET', '/x');
    expect(r).toEqual({ a: 1 });
    expect(fake.req(0).bearer).toBe(TOKEN);
  });

  it('uses an explicit bearer when given', async () => {
    const fake = new FakeCloudflare();
    await createCfApi(fake.transport, TOKEN).call('POST', '/x', undefined, 'jwt');
    expect(fake.req(0).bearer).toBe('jwt');
  });

  const cases: [string, ReturnType<typeof fail>, CfErrorCode][] = [
    ['401 + 10000', fail(401, 10000), 'invalid_token'],
    ['401 sin código', fail(401), 'invalid_token'],
    ['403 + 9109', fail(403, 9109), 'missing_permission'],
    ['403 sin código', fail(403), 'missing_permission'],
    ['10042', fail(400, 10042), 'r2_not_enabled'],
    ['429', fail(429), 'rate_limited'],
    ['404', fail(404, 7003), 'not_found'],
    ['subdominio ocupado', fail(409, 10036), 'subdomain_taken'],
    ['500', fail(500), 'unknown'],
  ];
  it.each(cases)('maps %s', async (_n, res, code) => {
    const err = await codeOf(res);
    expect(err.code).toBe(code);
  });

  it('maps a rejected transport to network', async () => {
    const api = createCfApi(() => Promise.reject(new Error(`boom ${TOKEN}`)), TOKEN);
    const err = (await api.call('GET', '/x').catch((e) => e)) as CfError;
    expect(err.code).toBe('network');
  });

  it('treats a non-JSON body as unknown and never leaks the token', async () => {
    const fake = new FakeCloudflare().on('GET /x', { status: 502, body: `<html>${TOKEN}</html>` });
    const err = (await createCfApi(fake.transport, TOKEN)
      .call('GET', '/x')
      .catch((e) => e)) as CfError;
    expect(err.code).toBe('unknown');
    expect(err.message).not.toContain(TOKEN);
  });
});

describe('TOKEN_CREATE_URL', () => {
  it('preloads the four permission groups', () => {
    expect(TOKEN_CREATE_URL.startsWith('https://dash.cloudflare.com/profile/api-tokens?')).toBe(
      true,
    );
    const decoded = decodeURIComponent(TOKEN_CREATE_URL);
    for (const key of ['workers_scripts', 'd1', 'workers_r2', 'account_settings']) {
      expect(decoded).toContain(`"key":"${key}"`);
    }
    expect(TOKEN_CREATE_URL).toContain('&name=Aske%20Stream&accountId=*&zoneId=all');
  });
});
