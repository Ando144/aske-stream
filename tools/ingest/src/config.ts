import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiConfig } from './upload';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Configuration comes from environment variables, optionally loaded from a
 * `.env` file (git-ignored) in the repository root or in tools/ingest.
 */
export function loadConfig(): ApiConfig {
  for (const candidate of [
    resolve(here, '../../../.env'),
    resolve(here, '../.env'),
    join(process.cwd(), '.env'),
  ]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      break;
    }
  }
  const url = process.env.ASKE_URL?.trim();
  const accessKey = process.env.ASKE_ACCESS_KEY?.trim();
  if (!url || !accessKey) {
    throw new Error(
      'Missing configuration. Copy .env.example to .env and set ASKE_URL and ASKE_ACCESS_KEY.',
    );
  }
  return { url: url.replace(/\/+$/, ''), accessKey };
}
