/**
 * Smart offline cache — rotation planner.
 *
 * Pure function, no I/O: given what is on the device, the library and the
 * settings, it decides what to delete and what to download. Keeping it pure
 * makes the policy easy to unit-test and to reason about.
 *
 * Policy
 *  1. Budget is expressed in minutes of music, not bytes.
 *  2. Pinned (manual) downloads are never rotated and count towards the budget.
 *  3. An automatic download "expires" once it has been listened to (≥ 80 %)
 *     and `rotateAfterMs` has passed since that first listen.
 *  4. Expired songs are swapped, not dropped: they are only deleted after
 *     enough replacement music has actually been downloaded. Offline, nothing
 *     is ever lost.
 *  5. Replacements are random, skipping songs rotated out recently (cooldown),
 *     unless the library is too small to do so.
 *  6. The song playing now (and the next one) are never touched.
 */

export type OfflineMode = 'pinned' | 'auto';

export interface OfflineEntry {
  trackId: string;
  mode: OfflineMode;
  durationMs: number;
  sizeBytes: number;
  downloadedAt: number;
  /** First time the song was listened to past the threshold since it was downloaded. */
  listenedAt: number | null;
}

export interface PlanInput {
  entries: OfflineEntry[];
  tracks: { id: string; durationMs: number }[];
  quotaMs: number;
  rotateAfterMs: number;
  autoFill: boolean;
  now: number;
  /** trackId → time it was rotated out. */
  recentlyEvicted: Map<string, number>;
  cooldownMs: number;
  protectedIds: ReadonlySet<string>;
  random?: () => number;
  /** Safety valve so one run never queues an absurd number of downloads. */
  maxDownloads?: number;
}

export interface RotationPlan {
  /** Delete right away (removed from library, or over budget after the quota shrank). */
  removeNow: string[];
  /** Fetch these as new automatic downloads, in order. */
  download: string[];
  /** Expired songs, oldest listen first; delete only as replacements arrive. */
  swapOut: string[];
}

export function isExpired(entry: OfflineEntry, now: number, rotateAfterMs: number): boolean {
  return (
    entry.mode === 'auto' && entry.listenedAt !== null && now - entry.listenedAt >= rotateAfterMs
  );
}

export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const sum = (entries: { durationMs: number }[]) => entries.reduce((t, e) => t + e.durationMs, 0);

export function planRotation(input: PlanInput): RotationPlan {
  const {
    now,
    quotaMs,
    rotateAfterMs,
    protectedIds,
    random = Math.random,
    maxDownloads = 60,
  } = input;
  const inLibrary = new Map(input.tracks.map((t) => [t.id, t]));
  const removeNow: string[] = [];

  // 1. Songs deleted from the library have no business on the device.
  const valid: OfflineEntry[] = [];
  for (const e of input.entries) {
    if (inLibrary.has(e.trackId) || protectedIds.has(e.trackId)) valid.push(e);
    else removeNow.push(e.trackId);
  }

  const pinnedMs = sum(valid.filter((e) => e.mode === 'pinned'));
  const autoBudget = Math.max(0, quotaMs - pinnedMs);
  const autos = valid.filter((e) => e.mode === 'auto');

  // 2. Fit automatic songs into the budget, keeping the most valuable first:
  //    protected > not yet heard > heard but fresh > expired (recently heard first).
  const rank = (e: OfflineEntry) => {
    if (protectedIds.has(e.trackId)) return 0;
    if (e.listenedAt === null) return 1;
    return isExpired(e, now, rotateAfterMs) ? 3 : 2;
  };
  const ordered = [...autos].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.listenedAt ?? 0) - (a.listenedAt ?? 0) ||
      b.downloadedAt - a.downloadedAt,
  );
  const kept: OfflineEntry[] = [];
  let usedMs = 0;
  for (const e of ordered) {
    if (usedMs + e.durationMs <= autoBudget || protectedIds.has(e.trackId)) {
      kept.push(e);
      usedMs += e.durationMs;
    } else {
      removeNow.push(e.trackId); // over budget: the user lowered the quota
    }
  }

  if (!input.autoFill) return { removeNow, download: [], swapOut: [] };

  // 3. Expired songs free their slot for replacements.
  const expired = kept
    .filter((e) => isExpired(e, now, rotateAfterMs) && !protectedIds.has(e.trackId))
    .sort((a, b) => (a.listenedAt ?? 0) - (b.listenedAt ?? 0));
  let remaining = autoBudget - (usedMs - sum(expired));

  // 4. Candidates: anything not on the device, preferring songs not rotated out lately.
  const onDevice = new Set(valid.map((e) => e.trackId));
  const notOnDevice = input.tracks.filter((t) => !onDevice.has(t.id) && t.durationMs > 0);
  const cooling = (id: string) => {
    const at = input.recentlyEvicted.get(id);
    return at !== undefined && now - at < input.cooldownMs;
  };
  let pool = shuffled(
    notOnDevice.filter((t) => !cooling(t.id)),
    random,
  );
  if (pool.length === 0) {
    // Small library: allow recently rotated songs back, oldest rotation first.
    pool = notOnDevice
      .filter((t) => cooling(t.id))
      .sort((a, b) => input.recentlyEvicted.get(a.id)! - input.recentlyEvicted.get(b.id)!);
  }

  const download: string[] = [];
  for (const t of pool) {
    if (download.length >= maxDownloads) break;
    if (t.durationMs <= remaining) {
      download.push(t.id);
      remaining -= t.durationMs;
    }
  }

  return { removeNow, download, swapOut: expired.map((e) => e.trackId) };
}

/**
 * How many expired songs to delete once `downloadedMs` of new music arrived:
 * delete while less music has been freed than downloaded, so the total stays
 * close to the quota and a failed download never leaves the device emptier.
 */
export function selectSwapOut(
  swapOut: string[],
  durations: Map<string, number>,
  downloadedMs: number,
): string[] {
  const out: string[] = [];
  let freed = 0;
  for (const id of swapOut) {
    if (freed >= downloadedMs) break;
    out.push(id);
    freed += durations.get(id) ?? 0;
  }
  return out;
}
