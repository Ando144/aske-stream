import { describe, expect, it } from 'vitest';
import { createSessionToken, safeEqual, verifySessionToken } from '../src/lib/crypto';
import { newId } from '../src/lib/ids';
import { ID_PATTERN } from '../src/lib/http';
import { mapStation } from '../src/lib/radioBrowser';
import { resolveRange } from '../src/routes/media';

const KEY = 'test-access-key-0123456789abcdef';

describe('session tokens', () => {
  it('accepts a token signed with the same key', async () => {
    const token = await createSessionToken(KEY);
    expect(await verifySessionToken(KEY, token)).toBe(true);
  });

  it('rejects tokens signed with another key (key rotation logs everyone out)', async () => {
    const token = await createSessionToken('another-key-0123456789abcdefgh');
    expect(await verifySessionToken(KEY, token)).toBe(false);
  });

  it('rejects tampered and expired tokens', async () => {
    const token = await createSessionToken(KEY, 1_000);
    const [v, , sig] = token.split('.');
    expect(await verifySessionToken(KEY, `${v}.2000.${sig}`, 5_000)).toBe(false);
    expect(await verifySessionToken(KEY, token, 1_000 + 401 * 24 * 3600 * 1000)).toBe(false);
    expect(await verifySessionToken(KEY, 'garbage')).toBe(false);
  });

  it('compares strings in constant time without leaking length mismatches', async () => {
    expect(await safeEqual('abc', 'abc')).toBe(true);
    expect(await safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('ids', () => {
  it('generates unique ids accepted by the router', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId()));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(ID_PATTERN);
  });
});

describe('resolveRange', () => {
  it('handles offset/length, open-ended and suffix ranges', () => {
    expect(resolveRange({ offset: 100, length: 50 }, 1000)).toEqual({ offset: 100, length: 50 });
    expect(resolveRange({ offset: 900 }, 1000)).toEqual({ offset: 900, length: 100 });
    expect(resolveRange({ suffix: 200 }, 1000)).toEqual({ offset: 800, length: 200 });
    expect(resolveRange({ suffix: 5000 }, 1000)).toEqual({ offset: 0, length: 1000 });
    expect(resolveRange(undefined, 1000)).toBeNull();
  });
});

describe('Radio Browser mapping', () => {
  const base = {
    stationuuid: '96062a7b-0601-11e8-ae97-52543be04c81',
    name: '  Radio Euskadi ',
    url: 'http://example.com/stream',
    url_resolved: 'https://example.com/stream',
    homepage: 'https://www.eitb.eus',
    favicon: 'http://example.com/icon.png',
    countrycode: 'es',
    tags: 'news,basque, talk',
    codec: 'MP3',
    bitrate: 128,
    hls: 0,
    votes: 10,
    clickcount: 5,
    lastcheckok: 1,
  };

  it('normalises a healthy https station', () => {
    expect(mapStation(base)).toMatchObject({
      name: 'Radio Euskadi',
      streamUrl: 'https://example.com/stream',
      favicon: '', // http favicons would be blocked as mixed content
      countryCode: 'ES',
      tags: ['news', 'basque', 'talk'],
    });
  });

  it('drops stations that cannot play over https or failed their last check', () => {
    expect(mapStation({ ...base, url: 'http://a', url_resolved: 'http://b' })).toBeNull();
    expect(mapStation({ ...base, lastcheckok: 0 })).toBeNull();
  });
});
