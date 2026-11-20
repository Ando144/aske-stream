import type { CfApi } from './api';
import type { WorkerBundle } from './bundle';
import { applyMigrations } from './migrations';
import { createSubdomain, ensureD1, ensureR2, getSubdomain } from './resources';
import { enableWorkersDev, uploadAssets, uploadScript, workerUrl } from './deploy';
import type { CfErrorCode } from './types';

export type SetupStep =
  | 'account'
  | 'subdomain'
  | 'database'
  | 'storage'
  | 'migrations'
  | 'files'
  | 'worker'
  | 'publish'
  | 'waiting';

export type SetupErrorCode =
  CfErrorCode | 'no_account' | 'wrong_account' | 'bundle_missing' | 'not_live_yet';

/** Failure of the orchestration itself (not of one Cloudflare call). */
export class SetupError extends Error {
  constructor(
    readonly code: SetupErrorCode,
    /** Set when everything is deployed and only the wait for the Worker failed. */
    readonly resume?: { baseUrl: string; accessKey?: string },
  ) {
    super(`Setup failed: ${code}`);
    this.name = 'SetupError';
  }
}

interface CommonOptions {
  api: CfApi;
  bundle: WorkerBundle;
  accountId: string;
  onStep(step: SetupStep): void;
}

export interface LiveOptions {
  fetchFn?: typeof fetch;
  tries?: number;
  delayMs?: number;
}

function newAccessKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function healthVersion(fetchFn: typeof fetch, baseUrl: string): Promise<string | null> {
  try {
    const res = await fetchFn(`${baseUrl}/api/health`);
    if (!res.ok) return null;
    return ((await res.json()) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

/** Polls /api/health until the Worker answers with the freshly deployed version. */
export async function waitUntilLive(
  baseUrl: string,
  version: string,
  o: LiveOptions = {},
): Promise<void> {
  const { fetchFn = fetch, tries = 36, delayMs = 5000 } = o;
  for (let i = 0; i < tries; i++) {
    if ((await healthVersion(fetchFn, baseUrl)) === version) return;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new SetupError('not_live_yet', { baseUrl });
}

/** Database, files and script: the part shared by setup and update. */
async function deploy(o: CommonOptions, accessKey?: string): Promise<void> {
  const { api, bundle, accountId, onStep } = o;
  onStep('database');
  const d1Id = await ensureD1(api, accountId);
  onStep('migrations');
  await applyMigrations(api, accountId, d1Id, bundle.manifest.migrations);
  onStep('files');
  const assetsJwt = await uploadAssets(api, accountId, bundle.manifest, bundle.readAsset);
  onStep('worker');
  await uploadScript(api, accountId, {
    code: bundle.code,
    manifest: bundle.manifest,
    assetsJwt,
    d1Id,
    accessKey,
  });
}

async function waitFor(o: CommonOptions, baseUrl: string, accessKey?: string, live?: LiveOptions) {
  o.onStep('waiting');
  try {
    await waitUntilLive(baseUrl, o.bundle.manifest.version, live);
  } catch (e) {
    if (e instanceof SetupError) throw new SetupError(e.code, { baseUrl, accessKey });
    throw e;
  }
}

export async function runSetup(
  o: CommonOptions & { subdomain: string; live?: LiveOptions },
): Promise<{ baseUrl: string; accessKey: string }> {
  const { api, accountId, onStep } = o;
  onStep('subdomain');
  const subdomain =
    (await getSubdomain(api, accountId)) ?? (await createSubdomain(api, accountId, o.subdomain));
  onStep('storage');
  await ensureR2(api, accountId);
  const accessKey = newAccessKey();
  await deploy(o, accessKey);
  onStep('publish');
  await enableWorkersDev(api, accountId);
  const baseUrl = workerUrl(subdomain);
  await waitFor(o, baseUrl, accessKey, o.live);
  return { baseUrl, accessKey };
}

/** `currentBaseUrl` is the Worker this app is connected to. */
export async function runUpdate(
  o: CommonOptions & { currentBaseUrl: string; live?: LiveOptions },
): Promise<{ baseUrl: string }> {
  const { api, accountId, onStep } = o;
  onStep('account');
  const subdomain = await getSubdomain(api, accountId);
  if (!subdomain || workerUrl(subdomain) !== o.currentBaseUrl)
    throw new SetupError('wrong_account');
  await deploy(o);
  await waitFor(o, o.currentBaseUrl, undefined, o.live);
  return { baseUrl: o.currentBaseUrl };
}
