import type { WorkerBundleManifest } from './types';

export interface WorkerBundle {
  manifest: WorkerBundleManifest;
  code: string;
  readAsset(path: string): Promise<string>;
}

const BASE = '/cf-bundle';
const CHUNK = 0x8000;

/** base64 in slices: btoa over one giant string overflows the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

async function fetchOrMissing(fetchFn: typeof fetch, url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    throw new Error('bundle_missing');
  }
  if (!res.ok) throw new Error('bundle_missing');
  return res;
}

/** Loads the Worker package shipped inside the Android app. */
export async function loadBundle(fetchFn: typeof fetch = fetch): Promise<WorkerBundle> {
  const manifest = (await (
    await fetchOrMissing(fetchFn, `${BASE}/manifest.json`)
  ).json()) as WorkerBundleManifest;
  const code = await (await fetchOrMissing(fetchFn, `${BASE}/index.js`)).text();
  return {
    manifest,
    code,
    async readAsset(path) {
      const res = await fetchOrMissing(fetchFn, `${BASE}/site${path}`);
      return bytesToBase64(new Uint8Array(await res.arrayBuffer()));
    },
  };
}
