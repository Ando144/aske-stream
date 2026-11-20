import type { SearchKind, SearchResult } from '@aske/shared/youtube';
import type {
  CatalogCountry,
  CatalogStation,
  CatalogTag,
  Folder,
  Library,
  Playlist,
  SendItem,
  StorageStats,
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

export interface ApiTarget {
  baseUrl: string;
  token: string | null;
}

const normalized = (conn: ApiTarget): ApiTarget => ({
  baseUrl: conn.baseUrl.replace(/\/+$/, ''),
  token: conn.token,
});

/**
 * Where the Cloudflare instance lives. Same-origin web app: baseUrl '' and the
 * HttpOnly cookie. Android app or another origin: absolute URL + device token.
 */
let target: ApiTarget = { baseUrl: '', token: null };

export function configureApi(baseUrl: string, token: string | null) {
  target = normalized({ baseUrl, token });
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
  form?: FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request(
  conn: ApiTarget,
  notifyUnauthorized: boolean,
  path: string,
  opts: RequestOptions = {},
): Promise<Response> {
  const headers = new Headers(opts.headers);
  if (conn.token) headers.set('Authorization', `Bearer ${conn.token}`);
  let body: string | FormData | undefined = opts.form;
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  }
  let res: Response;
  try {
    res = await fetch(conn.baseUrl + path, {
      method: opts.method ?? 'GET',
      headers,
      body,
      credentials: conn.baseUrl ? 'omit' : 'same-origin',
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', `No connection (${(err as Error).message})`);
  }
  if (notifyUnauthorized && res.status === 401 && !path.startsWith('/api/auth/')) {
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

type JsonFn = <T>(path: string, opts?: RequestOptions) => Promise<T>;
type CallFn = (path: string, opts?: RequestOptions) => Promise<Response>;

/** Folders and custom playlist covers (need the 0004 migration on the Worker). */
function folderMethods(json: JsonFn, call: CallFn) {
  return {
    createFolder: (name: string) =>
      json<Folder>('/api/folders', { method: 'POST', json: { name } }),
    updateFolder: (id: string, patch: { name?: string; pinned?: boolean }) =>
      json<Folder>(`/api/folders/${id}`, { method: 'PATCH', json: patch }),
    deleteFolder: (id: string) => json<void>(`/api/folders/${id}`, { method: 'DELETE' }),
    reorderFolders: (ids: string[]) =>
      json<Folder[]>('/api/folders/order', { method: 'PUT', json: { ids } }),
    orderPlaylists: (folderId: string | null, ids: string[]) =>
      json<{ playlists: Playlist[] }>('/api/playlists/order', {
        method: 'PUT',
        json: { folderId, ids },
      }),
    setPlaylistCover: (id: string, jpeg: Blob) => {
      const form = new FormData();
      form.append('cover', jpeg, 'cover.jpg');
      return json<Playlist>(`/api/playlists/${id}/cover`, { method: 'PUT', form });
    },
    removePlaylistCover: (id: string) =>
      json<Playlist>(`/api/playlists/${id}/cover`, { method: 'DELETE' }),
    fetchPlaylistCover: async (id: string): Promise<Blob> =>
      (await call(`/media/playlist-cover/${id}`)).blob(),
  };
}

function createApi(
  getTarget: () => ApiTarget,
  { notifyUnauthorized }: { notifyUnauthorized: boolean },
) {
  const call = (path: string, opts?: RequestOptions) =>
    request(getTarget(), notifyUnauthorized, path, opts);

  async function json<T>(path: string, opts?: RequestOptions): Promise<T> {
    const res = await call(path, opts);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  return {
    health: () => json<{ ok: boolean; version?: string }>('/api/health'),
    status: () => json<{ paired: boolean }>('/api/auth/status'),
    pairWithCode: (code: string) =>
      json<{ paired: boolean; token: string }>('/api/auth/pair', {
        method: 'POST',
        json: { code },
      }),
    createPairingCode: () =>
      json<{ code: string; expiresAt: number }>('/api/auth/pairing-codes', { method: 'POST' }),
    pair: (key: string) =>
      json<{ paired: boolean; token: string }>('/api/auth/pair', {
        method: 'POST',
        json: { key },
      }),
    logout: () => json<{ paired: boolean }>('/api/auth/logout', { method: 'POST' }),

    /** Returns `null` when the cached copy (identified by `etag`) is still current. */
    async library(etag?: string): Promise<{ library: Library; etag: string } | null> {
      const res = await call('/api/library', {
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
    updatePlaylist: (
      id: string,
      patch: { name?: string; description?: string; folderId?: string | null; pinned?: boolean },
    ) => json<Playlist>(`/api/playlists/${id}`, { method: 'PATCH', json: patch }),
    ...folderMethods(json, call),
    deletePlaylist: (id: string) => json<void>(`/api/playlists/${id}`, { method: 'DELETE' }),
    addToPlaylist: (id: string, trackIds: string[]) =>
      json<Playlist>(`/api/playlists/${id}/tracks`, { method: 'POST', json: { trackIds } }),
    reorderPlaylist: (id: string, trackIds: string[]) =>
      json<Playlist>(`/api/playlists/${id}/tracks`, { method: 'PUT', json: { trackIds } }),
    removeFromPlaylist: (id: string, trackId: string) =>
      json<Playlist>(`/api/playlists/${id}/tracks/${trackId}`, { method: 'DELETE' }),

    storage: () => json<StorageStats>('/api/library/storage'),

    /** multipart: meta (JSON), audio (Opus in Ogg/WebM), cover (JPEG, optional). */
    uploadTrack: (form: FormData, signal?: AbortSignal) =>
      json<Track>('/api/ingest/tracks', { method: 'POST', form, signal }),

    ingestExists: (source: 'youtube' | 'file', ref: string) =>
      json<{ exists: boolean; id: string | null }>(
        `/api/ingest/exists?${new URLSearchParams({ source, ref })}`,
      ),
    fetchMedia: async (kind: 'audio' | 'cover', remoteId: string): Promise<Blob> =>
      (await call(`/media/${kind}/${remoteId}`)).blob(),

    youtubeSearch: (q: string, kind: SearchKind, lang: string) =>
      json<{ results: SearchResult[] }>(
        `/api/youtube/search?${new URLSearchParams({ q, kind, lang })}`,
      ),
    sendList: () => json<SendItem[]>('/api/send'),
    sendCreate: (item: { url: string; title?: string; author?: string; thumbnail?: string }) =>
      json<SendItem>('/api/send', { method: 'POST', json: item }),
    sendUpdate: (id: string, status: SendItem['status'], detail = '') =>
      json<SendItem>(`/api/send/${id}`, { method: 'PATCH', json: { status, detail } }),
    sendDelete: (id: string) => json<void>(`/api/send/${id}`, { method: 'DELETE' }),

    stations: () => json<Station[]>('/api/stations'),
    saveStation: (
      station: Partial<Station> & { name: string; streamUrl: string; liked?: boolean },
    ) => json<Station>('/api/stations', { method: 'POST', json: station }),
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
      call(`/api/radio/click/${rbUuid}`, { method: 'POST' }).catch(() => undefined),
  };
}

export type ApiClient = ReturnType<typeof createApi>;

export const api: ApiClient = createApi(() => target, { notifyUnauthorized: true });

/** Client bound to its own connection; a 401 here never signs the active device out. */
export function apiFor(conn: ApiTarget): ApiClient {
  const own = normalized(conn);
  return createApi(() => own, { notifyUnauthorized: false });
}

/** URL of a file on the Cloudflare instance; carries the device token when cross-origin. */
export function mediaUrl(kind: 'audio' | 'cover', remoteId: string): string {
  const url = `${target.baseUrl}/media/${kind}/${remoteId}`;
  return target.token ? `${url}?t=${encodeURIComponent(target.token)}` : url;
}

/** Cover URL of a playlist; `v` breaks the browser cache when the cover changes. */
export function playlistCoverUrl(id: string, coverAt: number): string {
  const url = `${target.baseUrl}/media/playlist-cover/${id}?v=${coverAt}`;
  return target.token ? `${url}&t=${encodeURIComponent(target.token)}` : url;
}

export const mediaCredentials = (): RequestCredentials => (target.baseUrl ? 'omit' : 'same-origin');
