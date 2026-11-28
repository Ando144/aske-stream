// Files a canceled upload may leave in Drive: Google can finish them after the app stopped
// waiting. They are searched by upload id until none is left, without bothering the user.
import { driveApi } from '../storage/drive/api';
import { driveHome } from '../storage/drive/home';
import { useSetup } from '../stores/setup';

const KEY = 'aske.driveCleanups.v1';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
/** Until then a file may still show up, so finding nothing proves nothing. */
const SETTLE_MS = 2 * 60_000;

interface PendingDriveCleanup {
  id: string;
  at: number;
}

const isPendingCleanup = (value: unknown): value is PendingDriveCleanup => {
  const item = value as Partial<PendingDriveCleanup> | null;
  return typeof item?.id === 'string' && typeof item.at === 'number';
};

function readPending(): PendingDriveCleanup[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(isPendingCleanup) : [];
  } catch (err) {
    console.error('Could not read the pending Drive cleanups', err);
    return [];
  }
}

function writePending(list: PendingDriveCleanup[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Could not save the pending Drive cleanups', err);
  }
}

const forget = (id: string) => writePending(readPending().filter((p) => p.id !== id));

/** Deletes the files of that upload that no song uses. True when none is left at all. */
async function removeUnused(uploadId: string): Promise<boolean> {
  const found = await driveApi.findByUploadId(uploadId);
  if (!found.length) return true;
  const used = await driveHome.referencedFileIds();
  const unused = found.filter((file) => !used.has(file.id));
  for (const file of unused) await driveApi.remove(file.id);
  return unused.length === found.length;
}

async function attempt({ id, at }: PendingDriveCleanup): Promise<void> {
  const home = useSetup.getState().config?.home;
  const age = Date.now() - at;
  if (age > MAX_AGE_MS || (home && home !== 'drive')) return forget(id);
  // Without a known setup or network there is nothing to ask yet.
  if (!home || !navigator.onLine) return;
  try {
    if ((await removeUnused(id)) && age >= SETTLE_MS) forget(id);
  } catch (err) {
    console.error('Could not clean up a canceled Drive upload', id, err);
  }
}

/** Notes the cleanup and tries it once Google has had time to finish the file. */
export function registerDriveCleanup(uploadId: string): void {
  const item = { id: uploadId, at: Date.now() };
  writePending([...readPending().filter((p) => p.id !== uploadId), item]);
  setTimeout(() => {
    // Another retry (app reopened, internet back) may have finished it meanwhile.
    if (readPending().some((p) => p.id === uploadId)) void attempt(item);
  }, SETTLE_MS);
}

/** Tries every cleanup still pending. */
export async function retryDriveCleanups(): Promise<void> {
  for (const item of readPending()) await attempt(item);
}
