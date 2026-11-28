// Cancellations of Cloudflare uploads. The Worker deletes the song of that upload only, and blocks
// it if it arrives later. Those that do not reach the Worker are kept here and sent again.
import { api, ApiError } from '../api/client';
import { useLibrary } from '../stores/library';
import { useServerUpdate } from '../stores/serverUpdate';
import { useSetup } from '../stores/setup';

const KEY = 'aske.uploadCancels.v1';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
/** Waits between attempts: they happen 5 s and 60 s after the first failure. */
const RETRY_WAITS_MS = [5_000, 55_000];

interface PendingCancel {
  id: string;
  at: number;
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

const isPending = (id: string) => readPending().some((p) => p.id === id);

const forget = (id: string) => writePending(readPending().filter((p) => p.id !== id));

/** An old Worker lacks the endpoint. Nothing is deleted then: it could belong to someone else. */
const isOldWorker = (err: unknown) =>
  err instanceof ApiError &&
  err.status === 404 &&
  err.code === 'not_found' &&
  err.message === 'Unknown endpoint';

/** One attempt. True when there is nothing left to do for this cancellation. */
async function attempt({ id, at }: PendingCancel): Promise<boolean> {
  const home = useSetup.getState().config?.home;
  const expired = Date.now() - at > MAX_AGE_MS;
  if (expired || (home && home !== 'cloudflare')) {
    forget(id);
    return true;
  }
  // The setup is not known (yet): there is no server to ask.
  if (!home) return false;
  try {
    const { deletedIds } = await api.cancelUpload(id);
    forget(id);
    if (deletedIds.length) await useLibrary.getState().load();
    return true;
  } catch (err) {
    if (isOldWorker(err)) {
      useServerUpdate.getState().markOutdated();
      forget(id);
      return true;
    }
    console.error('Could not cancel an upload on the server', id, err);
    return false;
  }
}

/** Notes the cancellation, sends it now and, while it fails, a couple of times more. */
export async function cancelCloudUpload(uploadId: string): Promise<void> {
  const item = { id: uploadId, at: Date.now() };
  writePending([...readPending().filter((p) => p.id !== uploadId), item]);
  if (await attempt(item)) return;
  for (const wait of RETRY_WAITS_MS) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    // Another retry (app reopened, internet back) may have sent it meanwhile.
    if (!isPending(uploadId) || (await attempt(item))) return;
  }
}

/** Sends every cancellation still pending. */
export async function retryPendingCancels(): Promise<void> {
  for (const item of readPending()) await attempt(item);
}
