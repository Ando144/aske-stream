// Cancellations of Cloudflare uploads. The Worker deletes the song of that upload only, and blocks
// it if it arrives later. Those that do not reach the Worker, or find it outdated, are kept here
// and sent again.
import { api, ApiError } from '../api/client';
import { useLibrary } from '../stores/library';
import { useServerUpdate } from '../stores/serverUpdate';
import { useSetup } from '../stores/setup';
import { retryDriveCleanups } from './driveCleanups';

const KEY = 'aske.uploadCancels.v1';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
/** Waits between attempts: they happen 5 s and 60 s after the first failure. */
const RETRY_WAITS_MS = [5_000, 55_000];

/** Finds the song of an upload on a Worker too old to have noted its upload id. */
interface LegacyHint {
  ref: string;
  since: number;
}

interface PendingCancel {
  id: string;
  at: number;
  ref?: string;
  since?: number;
}

const isPendingCancel = (value: unknown): value is PendingCancel => {
  const item = value as Partial<PendingCancel> | null;
  return typeof item?.id === 'string' && typeof item.at === 'number';
};

function readPending(): PendingCancel[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(isPendingCancel) : [];
  } catch (err) {
    console.error('Could not read the pending upload cancellations', err);
    return [];
  }
}

function writePending(list: PendingCancel[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Could not save the pending upload cancellations', err);
  }
}

const findPending = (id: string) => readPending().find((p) => p.id === id);

const forget = (id: string) => writePending(readPending().filter((p) => p.id !== id));

/**
 * Drops the hint of a video: once its song is saved again, or turns out to be in the library
 * already, it would delete a song the user wants. The cancellation by upload id stays.
 */
export function forgetCancelsFor(videoId: string): void {
  const list = readPending();
  if (!list.some((p) => p.ref === videoId)) return;
  writePending(list.map((p) => (p.ref === videoId ? { id: p.id, at: p.at } : p)));
}

const hintArgs = ({ ref, since }: PendingCancel): [LegacyHint?] =>
  typeof ref === 'string' && typeof since === 'number' ? [{ ref, since }] : [];

/** An old Worker lacks the endpoint. */
const isOldWorker = (err: unknown) =>
  err instanceof ApiError &&
  err.status === 404 &&
  err.code === 'not_found' &&
  err.message === 'Unknown endpoint';

/** One attempt. True when there is no point in trying again for now. */
async function attempt(item: PendingCancel): Promise<boolean> {
  const { id, at } = item;
  const home = useSetup.getState().config?.home;
  const expired = Date.now() - at > MAX_AGE_MS;
  if (expired || (home && home !== 'cloudflare')) {
    forget(id);
    return true;
  }
  // The setup is not known (yet): there is no server to ask.
  if (!home) return false;
  try {
    const { deletedIds } = await api.cancelUpload(id, ...hintArgs(item));
    forget(id);
    if (deletedIds.length) await useLibrary.getState().load();
    return true;
  } catch (err) {
    if (isOldWorker(err)) {
      // Kept: it is sent again once the server is updated.
      useServerUpdate.getState().markOutdated();
      return true;
    }
    console.error('Could not cancel an upload on the server', id, err);
    return false;
  }
}

/** Notes the cancellation, sends it now and, while it fails, a couple of times more. */
export async function cancelCloudUpload(uploadId: string, legacy?: LegacyHint): Promise<void> {
  const item: PendingCancel = { id: uploadId, at: Date.now(), ...legacy };
  writePending([...readPending().filter((p) => p.id !== uploadId), item]);
  if (await attempt(item)) return;
  for (const wait of RETRY_WAITS_MS) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    // Read again: another retry may have sent it, or its hint may have been dropped meanwhile.
    const current = findPending(uploadId);
    if (!current || (await attempt(current))) return;
  }
}

/** Sends every cancellation still pending, and runs the pending Drive cleanups. */
export async function retryPendingCancels(): Promise<void> {
  for (const { id } of readPending()) {
    const current = findPending(id);
    if (current) await attempt(current);
  }
  await retryDriveCleanups();
}
