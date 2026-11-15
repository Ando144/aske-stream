import type {
  CatalogCountry,
  CatalogStation,
  CatalogTag,
  Library,
  Playlist,
  Station,
  Track,
} from '@aske/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Where the Cloudflare instance lives. Same-origin web app: baseUrl '' and the
 * HttpOnly cookie. Android app or another origin: absolute URL + device token.
 */
let target: { baseUrl: string; token: string | null } = { baseUrl: '', token: null };

export function configureApi(baseUrl: string, token: string | null) {
  target = { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Lets the setup store react when the server forgets this device. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RequestOptions {
  method?: string;
  json?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request(path: string, opts: RequestOptions = {}): Promise<Response> {
  const headers = new Headers(opts.headers);
  if (target.token) headers.set('Authorization', `Bearer ${target.token}`);
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  }
  let res: Response;
  try {
    res = await fetch(target.baseUrl + path, {
      method: opts.method ?? 'GET',
      headers,
      body,
      credentials: target.baseUrl ? 'omit' : 'same-origin',
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'No connection');
  }
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    unauthorizedListeners.forEach((l) => l());
  }
  if (!res.ok && res.status !== 304) {
    let code = 'http_error';
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      code = data.error ?? code;
      message = data.message ?? message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, code, message);
  }
  return res;
}

async function json<T>(path: string, opts?: RequestOptions): Promise<T> {
  const res = await request(path, opts);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  health: () => json<{ ok: boolean }>('/api/health'),
  status: () => json<{ paired: boolean }>('/api/auth/status'),
  pair: (key: string) =>
    json<{ paired: boolean; token: string }>('/api/auth/pair', { method: 'POST', json: { key } }),
  logout: () => json<{ paired: boolean }>('/api/auth/logout', { method: 'POST' }),

  /** Returns `null` when the cached copy (identified by `etag`) is still current. */
  async library(etag?: string): Promise<{ library: Library; etag: string } | null> {
    const res = await request('/api/library', {
      headers: etag ? { 'If-None-Match': etag } : undefined,
    });
    if (res.status === 304) return null;
    return { library: (await res.json()) as Library, etag: res.headers.get('ETag') ?? '' };
  },

  updateTrack: (
    id: string,
    patch: Partial<Pick<Track, 'title' | 'artist' | 'album' | 'kind'>> & { liked?: boolean },
  ) => json<Track>(`/api/tracks/${id}`, { method: 'PATCH', json: patch }),
  deleteTrack: (id: string) => json<void>(`/api/tracks/${id}`, { method: 'DELETE' }),

  createPlaylist: (name: string, trackIds: string[] = []) =>
    json<Playlist>('/api/playlists', { method: 'POST', json: { name, trackIds } }),
  updatePlaylist: (id: string, patch: { name?: string; description?: string }) =>
    json<Playlist>(`/api/playlists/${id}`, { method: 'PATCH', json: patch }),
  deletePlaylist: (id: string) => json<void>(`/api/playlists/${id}`, { method: 'DELETE' }),
  addToPlaylist: (id: string, trackIds: string[]) =>
    json<Playlist>(`/api/playlists/${id}/tracks`, { method: 'POST', json: { trackIds } }),
  reorderPlaylist: (id: string, trackIds: string[]) =>
    json<Playlist>(`/api/playlists/${id}/tracks`, { method: 'PUT', json: { trackIds } }),
  removeFromPlaylist: (id: string, trackId: string) =>
    json<Playlist>(`/api/playlists/${id}/tracks/${trackId}`, { method: 'DELETE' }),

  stations: () => json<Station[]>('/api/stations'),
  saveStation: (station: Partial<Station> & { name: string; streamUrl: string; liked?: boolean }) =>
    json<Station>('/api/stations', { method: 'POST', json: station }),
  updateStation: (id: string, patch: { liked?: boolean; name?: string }) =>
    json<Station>(`/api/stations/${id}`, { method: 'PATCH', json: patch }),
  deleteStation: (id: string) => json<void>(`/api/stations/${id}`, { method: 'DELETE' }),

  catalog: (
    query: {
      q?: string;
      country?: string;
      tag?: string;
      order?: string;
      offset?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') params.set(k, String(v));
    }
    return json<CatalogStation[]>(`/api/radio/stations?${params}`, { signal });
  },
  catalogTags: () => json<CatalogTag[]>('/api/radio/tags'),
  catalogCountries: () => json<CatalogCountry[]>('/api/radio/countries'),
  countClick: (rbUuid: string) =>
    request(`/api/radio/click/${rbUuid}`, { method: 'POST' }).catch(() => undefined),
};

/** URL of a file on the Cloudflare instance; carries the device token when cross-origin. */
export function mediaUrl(kind: 'audio' | 'cover', remoteId: string): string {
  const url = `${target.baseUrl}/media/${kind}/${remoteId}`;
  return target.token ? `${url}?t=${encodeURIComponent(target.token)}` : url;
}

export const mediaCredentials = (): RequestCredentials => (target.baseUrl ? 'omit' : 'same-origin');
