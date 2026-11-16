import { GOOGLE_WEB_CLIENT_ID } from '../../config';
import { loadValue, savePref } from '../../lib/storage';
import { GoogleDrive } from '../../native/googleDrive';
import { isNative } from '../../native/platform';

/**
 * Google sign-in for Drive, limited to the "drive.file" permission: the app
 * can only see the files it created itself.
 *
 *  - Android app: Google Play services hands out a fresh access token every
 *    time (silently, after the first "Allow").
 *  - Web: Google Identity Services. Tokens last an hour; renewing one may
 *    need a tap (browsers block pop-ups that the user did not ask for).
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Thrown when Google needs the user to confirm (web: a tap; app: the consent screen). */
export class DriveAuthRequired extends Error {
  constructor() {
    super('Google sign-in needed');
  }
}

let token: { value: string; expiresAt: number } | null = loadSessionToken();
const listeners = new Set<(needed: boolean) => void>();

function loadSessionToken() {
  try {
    const raw = sessionStorage.getItem('aske:drive-token');
    const t = raw ? (JSON.parse(raw) as { value: string; expiresAt: number }) : null;
    return t && t.expiresAt > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

function remember(value: string, seconds = 3600) {
  token = { value, expiresAt: Date.now() + (seconds - 120) * 1000 };
  try {
    sessionStorage.setItem('aske:drive-token', JSON.stringify(token));
  } catch {
    // private mode
  }
  listeners.forEach((l) => l(false));
}

/** UI hook: tells when the web app needs a tap to reconnect to Google. */
export function onDriveAuthNeeded(listener: (needed: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const driveAvailable = () => isNative || GOOGLE_WEB_CLIENT_ID !== '';

/* ------------------------------ web (GIS) ------------------------------ */

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(o?: { prompt?: string }): void;
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(o: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

let gisLoading: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  gisLoading ??= new Promise((resolve, reject) => {
    const w = window as unknown as { google?: Gis };
    if (w.google?.accounts?.oauth2) return resolve(w.google);
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => (w.google ? resolve(w.google) : reject(new Error('Google did not load')));
    script.onerror = () => {
      gisLoading = null;
      reject(new Error('Could not reach Google'));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

async function webToken(): Promise<string> {
  const gis = await loadGis();
  const consentGiven = loadValue<boolean>('drive-consent', false);
  return new Promise((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (r.access_token) {
          savePref('drive-consent', true);
          remember(r.access_token, r.expires_in ?? 3600);
          resolve(r.access_token);
        } else reject(new Error(r.error ?? 'Google refused access'));
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'canceled' : e.type)),
    });
    client.requestAccessToken({ prompt: consentGiven ? '' : 'consent' });
  });
}

/* --------------------------------- api --------------------------------- */

/**
 * A valid access token. `interactive` must only be true right after a tap
 * (it may open Google's window).
 */
export async function getDriveToken(interactive = false): Promise<string> {
  if (token && token.expiresAt > Date.now()) return token.value;
  if (isNative) {
    try {
      const r = await GoogleDrive.authorize({ interactive });
      remember(r.accessToken, 3600);
      return r.accessToken;
    } catch (err) {
      if ((err as { code?: string }).code === 'consent_required') {
        listeners.forEach((l) => l(true));
        throw new DriveAuthRequired();
      }
      throw err;
    }
  }
  if (!interactive) {
    listeners.forEach((l) => l(true));
    throw new DriveAuthRequired();
  }
  return webToken();
}

/** After a 401 from Google: forget the token so the next call gets a new one. */
export function invalidateDriveToken() {
  token = null;
  try {
    sessionStorage.removeItem('aske:drive-token');
  } catch {
    // ignore
  }
}

export async function signOutDrive() {
  const current = token?.value;
  invalidateDriveToken();
  savePref('drive-consent', false);
  if (isNative) await GoogleDrive.revoke().catch(() => undefined);
  else if (current) {
    const w = window as unknown as { google?: Gis };
    w.google?.accounts.oauth2.revoke(current);
  }
}

/** Kind of problem when connecting to Google, for a plain-language message. */
export type DriveProblem = 'canceled' | 'offline' | 'notRegistered' | 'blocked' | 'other';

export function driveProblem(err: unknown): DriveProblem {
  const e = err as { code?: string; message?: string };
  const m = `${e.code ?? ''} ${e.message ?? ''}`.toLowerCase();
  if (!navigator.onLine || m.includes('network') || m.includes('could not reach')) return 'offline';
  if (m.includes('canceled') || m.includes('popup_closed') || m.includes('closed the google'))
    return 'canceled';
  if (m.includes('developer_error') || m.includes('not registered') || m.includes('invalid_client'))
    return 'notRegistered';
  if (m.includes('popup_failed') || m.includes('access_denied')) return 'blocked';
  return 'other';
}
