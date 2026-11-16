import { getDriveToken, invalidateDriveToken } from './auth';

/**
 * Minimal Google Drive v3 client (fetch + the user's access token).
 * Media downloads must send the token in a header (Google stopped accepting
 * it in the address in 2020), so audio is fetched and played as a blob.
 */

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

export interface DriveFile {
  id: string;
  name: string;
  size?: string;
  version?: string;
  modifiedTime?: string;
}

export interface DriveQuota {
  /** null = unlimited (some Workspace accounts). */
  limit: number | null;
  usage: number;
  email: string;
}

export class DriveError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = await getDriveToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  // A request that never answers (bad mobile signal) must not freeze the app.
  const ms = init.body instanceof Blob ? 600_000 : url.includes('alt=media') ? 300_000 : 45_000;
  const timeout = AbortSignal.timeout(ms);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal });
  } catch (err) {
    if (init.signal?.aborted) throw err;
    throw new DriveError(0, 'network_error', 'No connection to Google Drive');
  }
  if (res.status === 401 && !retried) {
    invalidateDriveToken();
    return call(url, init, true);
  }
  if (!res.ok) {
    let reason = '';
    let message = res.statusText;
    try {
      const body = (await res.json()) as {
        error?: { message?: string; errors?: { reason?: string }[] };
      };
      reason = body.error?.errors?.[0]?.reason ?? '';
      message = body.error?.message ?? message;
    } catch {
      // not JSON
    }
    const code = reason === 'storageQuotaExceeded' ? 'drive_full' : reason || 'drive_error';
    throw new DriveError(res.status, code, message);
  }
  return res;
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function findOne(query: string): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    q: `${query} and trashed=false`,
    fields: 'files(id,name,size,version,modifiedTime)',
    pageSize: '10',
    spaces: 'drive',
  });
  const res = await call(`${API}/files?${params}`);
  const { files } = (await res.json()) as { files: DriveFile[] };
  return files[0] ?? null;
}

export const driveApi = {
  /** Only finds folders this app created (that is all "drive.file" can see). */
  async findFolder(name: string, parentId?: string): Promise<string | null> {
    const parent = parentId ? ` and '${q(parentId)}' in parents` : '';
    return (await findOne(`mimeType='${FOLDER}' and name='${q(name)}'${parent}`))?.id ?? null;
  },

  async createFolder(name: string, parentId?: string): Promise<string> {
    const res = await call(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: parentId ? [parentId] : undefined }),
    });
    return ((await res.json()) as { id: string }).id;
  },

  findFile(name: string, parentId: string): Promise<DriveFile | null> {
    return findOne(`name='${q(name)}' and '${q(parentId)}' in parents`);
  },

  async get(fileId: string): Promise<DriveFile> {
    const res = await call(`${API}/files/${fileId}?fields=id,name,size,version,modifiedTime`);
    return (await res.json()) as DriveFile;
  },

  async download(fileId: string, signal?: AbortSignal): Promise<Blob> {
    return (await call(`${API}/files/${fileId}?alt=media`, { signal })).blob();
  },

  /**
   * Resumable upload (works for any size): one request with the details,
   * then the bytes to the address Google answers with.
   */
  async upload(
    meta: { name: string; mimeType: string; parentId: string },
    blob: Blob,
  ): Promise<DriveFile> {
    const start = await call(`${UPLOAD}/files?uploadType=resumable&fields=id,name,size,version`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': meta.mimeType,
        'X-Upload-Content-Length': String(blob.size),
      },
      body: JSON.stringify({ name: meta.name, mimeType: meta.mimeType, parents: [meta.parentId] }),
    });
    const location = start.headers.get('Location');
    if (!location)
      throw new DriveError(0, 'upload_failed', 'Google did not give an upload address');
    let res: Response;
    try {
      res = await fetch(location, {
        method: 'PUT',
        body: blob,
        signal: AbortSignal.timeout(600_000),
      });
    } catch {
      throw new DriveError(0, 'network_error', 'The upload was interrupted');
    }
    if (!res.ok) throw new DriveError(res.status, 'upload_failed', `Upload failed (${res.status})`);
    return (await res.json()) as DriveFile;
  },

  /** Replaces a file's content (the library file). */
  async replace(fileId: string, blob: Blob): Promise<DriveFile> {
    const res = await call(`${UPLOAD}/files/${fileId}?uploadType=media&fields=id,name,version`, {
      method: 'PATCH',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    });
    return (await res.json()) as DriveFile;
  },

  async remove(fileId: string): Promise<void> {
    try {
      await call(`${API}/files/${fileId}`, { method: 'DELETE' });
    } catch (err) {
      if (!(err instanceof DriveError && err.status === 404)) throw err;
    }
  },

  async quota(): Promise<DriveQuota> {
    const res = await call(`${API}/about?fields=storageQuota(limit,usage),user(emailAddress)`);
    const about = (await res.json()) as {
      storageQuota: { limit?: string; usage?: string };
      user?: { emailAddress?: string };
    };
    return {
      limit: about.storageQuota.limit ? Number(about.storageQuota.limit) : null,
      usage: Number(about.storageQuota.usage ?? 0),
      email: about.user?.emailAddress ?? '',
    };
  },
};

export type DriveApi = typeof driveApi;
