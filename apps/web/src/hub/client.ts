import type {
  ClaimedParcel,
  CreatedJam,
  CreatedParcel,
  ParcelStatus,
  CreatedList,
  HubErrorCode,
  HubSong,
  JamInfo,
  SharedList,
} from '@aske/shared/hub';
import type { SearchResult } from '@aske/shared/youtube';
import { HUB_URL } from '../config';
import type { Language } from '../i18n';

export class HubError extends Error {
  constructor(
    readonly code: HubErrorCode | 'network' | 'unavailable',
    readonly status: number,
    message: string = code,
  ) {
    super(message);
    this.name = 'HubError';
  }
}

export function hubAvailable(): boolean {
  return HUB_URL !== '';
}

const hubBase = () => HUB_URL.replace(/\/+$/, '');

interface HubRequest {
  method?: string;
  json?: unknown;
  headers?: Record<string, string>;
}

async function readError(res: Response): Promise<HubError> {
  const body = (await res.json().catch(() => null)) as {
    error?: HubErrorCode;
    message?: string;
  } | null;
  return new HubError(body?.error ?? 'internal_error', res.status, body?.message);
}

async function hubFetch<T>(path: string, opts: HubRequest = {}): Promise<T> {
  if (!hubAvailable()) throw new HubError('unavailable', 0);
  const headers = new Headers(opts.headers);
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  }
  let res: Response;
  try {
    res = await fetch(`${hubBase()}/hub/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    throw new HubError('network', 0);
  }
  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function createSharedList(name: string, songs: HubSong[]): Promise<CreatedList> {
  return hubFetch('/lists', { method: 'POST', json: { name, songs } });
}

export function getSharedList(id: string): Promise<SharedList> {
  return hubFetch(`/lists/${encodeURIComponent(id)}`);
}

export function deleteSharedList(id: string, deleteKey: string): Promise<void> {
  return hubFetch(`/lists/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Delete-Key': deleteKey },
  });
}

export function createJam(hostName: string): Promise<CreatedJam> {
  return hubFetch('/jams', { method: 'POST', json: { hostName } });
}

export function getJam(code: string): Promise<JamInfo> {
  return hubFetch(`/jams/${encodeURIComponent(code)}`);
}

export async function searchInJam(
  code: string,
  q: string,
  lang: Language,
): Promise<SearchResult[]> {
  const query = new URLSearchParams({ q, lang });
  const res = await hubFetch<{ results: SearchResult[] }>(
    `/jams/${encodeURIComponent(code)}/search?${query}`,
  );
  return res.results;
}

export function createParcel(songs: HubSong[]): Promise<CreatedParcel> {
  return hubFetch('/parcels', { method: 'POST', json: { songs } });
}

export function getParcelStatus(code: string, senderKey: string): Promise<ParcelStatus> {
  return hubFetch(`/parcels/${encodeURIComponent(code)}`, {
    headers: { 'X-Delete-Key': senderKey },
  });
}

export function claimParcel(code: string): Promise<ClaimedParcel> {
  return hubFetch(`/parcels/${encodeURIComponent(code)}/claim`, { method: 'POST' });
}

export function cancelParcel(code: string, senderKey: string): Promise<void> {
  return hubFetch(`/parcels/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: { 'X-Delete-Key': senderKey },
  });
}

export async function searchViaHub(
  q: string,
  kind: 'songs' | 'videos',
  lang: Language,
): Promise<SearchResult[]> {
  const query = new URLSearchParams({ q, kind, lang });
  const res = await hubFetch<{ results: SearchResult[] }>(`/search?${query}`);
  return res.results;
}

/** WebSocket address of a Jam: https becomes wss, http becomes ws. */
export function jamSocketUrl(code: string): string {
  const url = new URL(`${hubBase()}/hub/v1/jams/${encodeURIComponent(code)}/ws`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
