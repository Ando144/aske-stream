import { GROUP_LIMITS } from '@aske/shared/groups';
import { uploadStats } from '../hub/groupsClient';
import { loadValue, savePref } from '../lib/storage';
import { useGroups } from '../stores/groups';
import { getStatsRepo, useStats } from '../stores/stats';
import { buildUploads, monthsToUpload, uploadRange } from './snapshot';

const FORCE_MIN_GAP_MS = 15 * 60 * 1000;
let running = false;
let inFlight: Promise<void> | null = null;

/** Resolves once any upload in progress has finished, so a wipe cannot be overtaken by it. */
export async function waitForGroupSync(): Promise<void> {
  await inFlight;
}

function isDue(last: number | null, now: number, force: boolean): boolean {
  if (last === null) return true;
  return now - last >= (force ? FORCE_MIN_GAP_MS : GROUP_LIMITS.syncEveryMs);
}

/** Sends this device's monthly stats to its groups, at most every 6 hours. */
export async function syncGroupStats(opts: { force?: boolean } = {}): Promise<void> {
  const { consent, groups } = useGroups.getState();
  if (consent !== 'on' || groups.length === 0 || useStats.getState().consent !== 'on') return;
  const now = Date.now();
  const last = loadValue<number | null>('groups-last-sync', null);
  if (running || !isDue(last, now, opts.force === true)) return;

  running = true;
  inFlight = upload(last, now).finally(() => {
    running = false;
    inFlight = null;
  });
  await inFlight;
}

async function upload(last: number | null, now: number): Promise<void> {
  try {
    const firstSync = last === null;
    const { from, to } = uploadRange(monthsToUpload(now, firstSync));
    const records = await getStatsRepo().listBetween(from, to);
    const months = buildUploads(records, now, firstSync);
    if (months.length > 0) await uploadStats(months);
    // Sharing may have been switched off while uploading; do not mark it as synced.
    if (useGroups.getState().consent === 'on') savePref('groups-last-sync', now);
  } catch (err) {
    console.error('Could not sync group stats', err);
  }
}
