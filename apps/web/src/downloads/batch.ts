// Pure helpers for download batches and imported playlists (no stores, no Capacitor).

export type BatchJobStatus =
  'queued' | 'downloading' | 'saving' | 'done' | 'skipped' | 'error' | 'canceled';

export interface BatchJob {
  status: BatchJobStatus;
  batchId?: string;
  createdAt: number;
}

export interface PlaylistImport {
  playlistId: string;
  videoIds: string[];
}

const LEGACY_BATCH = 'legacy';
const ACTIVE: ReadonlySet<BatchJobStatus> = new Set(['queued', 'downloading', 'saving']);
const COUNTED: ReadonlySet<BatchJobStatus> = new Set([
  'queued',
  'downloading',
  'saving',
  'done',
  'error',
]);

const batchOf = (job: BatchJob) => job.batchId ?? LEGACY_BATCH;

function activeBatchIds(jobs: readonly BatchJob[]): Set<string> {
  return new Set(jobs.filter((j) => ACTIVE.has(j.status)).map(batchOf));
}

/** Numbers shown in the notification: "Downloading {position} of {total}". */
export function notificationCounts(
  jobs: readonly BatchJob[],
): { position: number; total: number } | null {
  const active = activeBatchIds(jobs);
  if (active.size === 0) return null;
  const counted = jobs.filter((j) => active.has(batchOf(j)) && COUNTED.has(j.status));
  const finished = counted.filter((j) => j.status === 'done' || j.status === 'error').length;
  const total = counted.length;
  return { position: Math.min(finished + 1, total), total };
}

/** Batch a retried job joins: the most recent active batch, or a new one. */
export function batchForRetry(jobs: readonly BatchJob[], now: number): string {
  let best: { id: string; at: number } | null = null;
  for (const job of jobs) {
    if (!ACTIVE.has(job.status)) continue;
    if (!best || job.createdAt > best.at) best = { id: batchOf(job), at: job.createdAt };
  }
  return best ? best.id : `b${now.toString(36)}`;
}

/**
 * Imports worth keeping: some of their songs are still active, failed or canceled (those may be
 * retried, and the full list keeps the YouTube order). Discarding those jobs prunes them.
 */
export function importsToKeep(
  imports: readonly PlaylistImport[],
  jobs: readonly { videoId: string; status: BatchJobStatus }[],
): PlaylistImport[] {
  const waiting = new Set(
    jobs
      .filter((j) => ACTIVE.has(j.status) || j.status === 'error' || j.status === 'canceled')
      .map((j) => j.videoId),
  );
  return imports.filter((i) => i.videoIds.some((v) => waiting.has(v)));
}

/** Imported tracks first (YouTube order), then the user's own tracks; no duplicates. */
export function arrangeImportedPlaylist(
  videoIds: readonly string[],
  currentTrackIds: readonly string[],
  trackIdOf: (videoId: string) => string | undefined,
  max: number,
): string[] {
  const imported: string[] = [];
  for (const videoId of videoIds) {
    const id = trackIdOf(videoId);
    if (id !== undefined) imported.push(id);
  }
  return [...new Set([...imported, ...currentTrackIds])].slice(0, max);
}

const normalizeName = (name: string) => name.trim().toLowerCase();

/** First free Windows-style name: "Name (1)", "Name (2)"... */
export function uniquePlaylistName(
  name: string,
  existingNames: readonly string[],
  maxLength: number,
): string {
  const taken = new Set(existingNames.map(normalizeName));
  if (!taken.has(normalizeName(name))) return name;
  const base = name.trim();
  for (let n = 1; ; n++) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, Math.max(0, maxLength - suffix.length)).trimEnd() + suffix;
    if (!taken.has(normalizeName(candidate))) return candidate;
  }
}
