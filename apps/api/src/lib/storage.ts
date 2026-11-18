import type { StorageStats } from '@aske/shared';
import type { Env } from '../env';

const GB = 1_000_000_000;
/** Covers are not sized in the database; ~80 KB each is a safe estimate (512 px JPEG). */
const COVER_ESTIMATE = 80_000;
/** Keep 5 % free for covers, metadata and rounding, so the real bill stays at 0. */
const SAFETY = 0.95;

export function storageLimit(env: Env): number {
  const gb = Number(env.STORAGE_LIMIT_GB ?? '10');
  return (Number.isFinite(gb) && gb > 0 ? gb : 10) * GB;
}

export async function storageStats(env: Env): Promise<StorageStats> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS tracks,
            COALESCE(SUM(size_bytes), 0) AS audio,
            COALESCE(SUM(CASE WHEN cover_key IS NOT NULL THEN 1 ELSE 0 END), 0) AS covers,
            (SELECT COUNT(*) FROM playlists WHERE cover_at IS NOT NULL) AS playlistCovers
     FROM tracks`,
  ).first<{ tracks: number; audio: number; covers: number; playlistCovers: number }>();
  const limitBytes = storageLimit(env);
  return {
    trackCount: row?.tracks ?? 0,
    usedBytes:
      (row?.audio ?? 0) + ((row?.covers ?? 0) + (row?.playlistCovers ?? 0)) * COVER_ESTIMATE,
    limitBytes,
    uploadLimitBytes: Math.floor(limitBytes * SAFETY),
  };
}
