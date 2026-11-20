import type { CfApi } from './api';
import { BUCKET_NAME, CfError, D1_NAME, SCRIPT_NAME } from './types';

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof CfError && e.code === 'not_found') return null;
    throw e;
  }
}

export async function verifyToken(api: CfApi): Promise<void> {
  const r = await api.call<{ status?: string }>('GET', '/user/tokens/verify');
  if (r?.status !== 'active') throw new CfError('invalid_token', 200, []);
}

export function listAccounts(api: CfApi): Promise<{ id: string; name: string }[]> {
  return api.call('GET', '/accounts');
}

export async function getSubdomain(api: CfApi, accountId: string): Promise<string | null> {
  const r = await orNull(
    api.call<{ subdomain?: string } | null>('GET', `/accounts/${accountId}/workers/subdomain`),
  );
  return r?.subdomain || null;
}

export async function createSubdomain(
  api: CfApi,
  accountId: string,
  name: string,
): Promise<string> {
  if (!SUBDOMAIN_RE.test(name)) throw new CfError('subdomain_invalid', 0, []);
  const r = await api.call<{ subdomain: string }>(
    'PUT',
    `/accounts/${accountId}/workers/subdomain`,
    { json: { subdomain: name } },
  );
  return r.subdomain;
}

export async function scriptExists(api: CfApi, accountId: string): Promise<boolean> {
  const path = `/accounts/${accountId}/workers/scripts/${SCRIPT_NAME}/settings`;
  return (await orNull(api.call('GET', path))) !== null;
}

export async function ensureD1(api: CfApi, accountId: string): Promise<string> {
  const base = `/accounts/${accountId}/d1/database`;
  const found = await api.call<{ uuid: string; name: string }[]>('GET', `${base}?name=${D1_NAME}`);
  const existing = found?.find((d) => d.name === D1_NAME);
  if (existing) return existing.uuid;
  const created = await api.call<{ uuid: string }>('POST', base, { json: { name: D1_NAME } });
  return created.uuid;
}

export async function ensureR2(api: CfApi, accountId: string): Promise<void> {
  const base = `/accounts/${accountId}/r2/buckets`;
  const found = await orNull(api.call('GET', `${base}/${BUCKET_NAME}`));
  if (found === null) await api.call('POST', base, { json: { name: BUCKET_NAME } });
}
