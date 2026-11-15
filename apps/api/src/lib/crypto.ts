const encoder = new TextEncoder();

export function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)));
}

/**
 * Constant-time string comparison. Both inputs are hashed first so the
 * comparison loop always runs over 32 bytes, whatever the input lengths.
 */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i]! ^ vb[i]!;
  return diff === 0;
}

const TOKEN_VERSION = 'v1';
/** Sessions last about a year; re-pair the device after that. */
export const SESSION_MAX_AGE_S = 400 * 24 * 60 * 60;

/** `v1.<issuedAt>.<hmac>` — stateless, invalidated by rotating ACCESS_KEY. */
export async function createSessionToken(key: string, now = Date.now()): Promise<string> {
  const payload = `${TOKEN_VERSION}.${now}`;
  return `${payload}.${await hmac(key, payload)}`;
}

export async function verifySessionToken(
  key: string,
  token: string,
  now = Date.now(),
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return false;
  const issuedAt = Number(parts[1]);
  if (!Number.isSafeInteger(issuedAt)) return false;
  if (issuedAt > now + 60_000 || now - issuedAt > SESSION_MAX_AGE_S * 1000) return false;
  const expected = await hmac(key, `${parts[0]}.${parts[1]}`);
  return safeEqual(expected, parts[2]!);
}
