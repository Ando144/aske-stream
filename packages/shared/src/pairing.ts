// 32 symbols, without 0/1/I/O to avoid confusion when typing the code by hand.
export const PAIRING_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const PAIRING_CODE_LENGTH = 8;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const PAIRING_MAX_ATTEMPTS = 5;

const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

/** Uppercases and strips spaces and dashes; null unless it is 8 symbols of the alphabet. */
export function normalizePairingCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  if (code.length !== PAIRING_CODE_LENGTH) return null;
  for (const char of code) {
    if (!PAIRING_CODE_ALPHABET.includes(char)) return null;
  }
  return code;
}

/** 'ABCD2345' becomes 'ABCD-2345'. */
export function formatPairingCode(code: string): string {
  const half = code.length / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

export function pairingLink(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/#code=${code}`;
}

function isAllowedOrigin(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(url.hostname);
}

/** Accepts https (or http for local hosts only); returns the origin and the normalized code. */
export function parsePairingLink(text: string): { baseUrl: string; code: string } | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (!isAllowedOrigin(url)) return null;
  const raw = new URLSearchParams(url.hash.replace(/^#/, '')).get('code');
  const code = raw === null ? null : normalizePairingCode(raw);
  return code ? { baseUrl: url.origin, code } : null;
}
