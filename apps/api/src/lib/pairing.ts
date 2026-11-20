import {
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  PAIRING_CODE_TTL_MS,
  PAIRING_MAX_ATTEMPTS,
} from '@aske/shared/pairing';

/** Largest multiple of the alphabet size that fits in a byte: avoids modulo bias. */
const UNBIASED_LIMIT = 256 - (256 % PAIRING_CODE_ALPHABET.length);

export function generatePairingCode(): string {
  let code = '';
  while (code.length < PAIRING_CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(PAIRING_CODE_LENGTH))) {
      if (byte < UNBIASED_LIMIT && code.length < PAIRING_CODE_LENGTH) {
        code += PAIRING_CODE_ALPHABET[byte % PAIRING_CODE_ALPHABET.length];
      }
    }
  }
  return code;
}

/** Codes are stored hashed, so a leaked database does not reveal usable codes. */
export async function hashPairingCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Replaces any previous code: only one is active at a time. Returns its expiry. */
export async function storePairingCode(
  db: D1Database,
  code: string,
  now = Date.now(),
): Promise<number> {
  const expiresAt = now + PAIRING_CODE_TTL_MS;
  const hash = await hashPairingCode(code);
  await db.batch([
    db.prepare('DELETE FROM pairing_codes'),
    db
      .prepare('INSERT INTO pairing_codes (code_hash, expires_at) VALUES (?, ?)')
      .bind(hash, expiresAt),
  ]);
  return expiresAt;
}

/**
 * Consumes a code atomically (single use). On failure, counts the attempt
 * against the active codes and drops the expired or exhausted ones.
 */
export async function claimPairingCode(
  db: D1Database,
  code: string,
  now = Date.now(),
): Promise<boolean> {
  const hash = await hashPairingCode(code);
  const claimed = await db
    .prepare(
      'DELETE FROM pairing_codes WHERE code_hash = ? AND expires_at > ? AND attempts < ? RETURNING code_hash',
    )
    .bind(hash, now, PAIRING_MAX_ATTEMPTS)
    .first();
  if (claimed) return true;
  await db.batch([
    db.prepare('UPDATE pairing_codes SET attempts = attempts + 1 WHERE expires_at > ?').bind(now),
    db
      .prepare('DELETE FROM pairing_codes WHERE attempts >= ? OR expires_at <= ?')
      .bind(PAIRING_MAX_ATTEMPTS, now),
  ]);
  return false;
}
