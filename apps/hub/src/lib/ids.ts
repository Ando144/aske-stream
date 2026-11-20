import { PAIRING_CODE_ALPHABET } from '@aske/shared/pairing';

/** Random string over the pairing alphabet (32 symbols, so `byte % 32` is uniform). */
export function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += PAIRING_CODE_ALPHABET[b % PAIRING_CODE_ALPHABET.length];
  return out;
}
