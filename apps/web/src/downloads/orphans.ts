// Canceling a save can lose the answer of a cloud that had already stored the song. These songs
// are found by comparing the library before and after, then deleted.
import type { LocalTrack } from '../storage/types';
import { useLibrary } from '../stores/library';
import { useSetup } from '../stores/setup';
import { isActive } from './jobsStore';
import type { DownloadJob } from './types';

/** The cloud may still be storing the song at the first pass; the second one catches slow ones. */
const SWEEP_DELAYS_MS = [5_000, 60_000];

export function idsForVideo(tracks: readonly LocalTrack[], videoId: string): string[] {
  return tracks
    .filter((tr) => tr.source === 'youtube' && tr.sourceRef === videoId)
    .map((t) => t.id);
}

export function findOrphans(
  tracks: readonly LocalTrack[],
  videoId: string,
  knownIds: readonly string[],
): LocalTrack[] {
  const known = new Set(knownIds);
  const ofVideo = new Set(idsForVideo(tracks, videoId));
  return tracks.filter((tr) => ofVideo.has(tr.id) && !known.has(tr.id));
}

function cloudHome(): 'cloudflare' | 'drive' | null {
  const home = useSetup.getState().config?.home;
  return home === 'cloudflare' || home === 'drive' ? home : null;
}

const libraryTracks = () => Object.values(useLibrary.getState().tracks);

/**
 * The songs of this video the library has right now, to be read before aborting the save.
 * Null when there is nothing to compare with: not a cloud library, or not loaded yet.
 */
export function snapshotKnownIds(videoId: string): string[] | null {
  if (!cloudHome() || !useLibrary.getState().loaded) return null;
  return idsForVideo(libraryTracks(), videoId);
}

/** Calls back on every change of the job list; returns how to stop. */
type WatchJobs = (onChange: (jobs: readonly DownloadJob[]) => void) => () => void;

interface Sweep {
  videoId: string;
  home: string;
  knownIds: readonly string[];
  /** Songs some job has told the user they have. Kept even if that job is cleared later. */
  claimed: Set<string>;
  currentJobs: () => readonly DownloadJob[];
}

function claimTracks(claimed: Set<string>, jobs: readonly DownloadJob[]): void {
  for (const { status, trackId } of jobs) {
    if (trackId && (status === 'done' || status === 'skipped')) claimed.add(trackId);
  }
}

/** False once another storage is in use, or the same video is being downloaded again. */
function maySweep({ videoId, home, currentJobs }: Sweep): boolean {
  if (cloudHome() !== home) return false;
  return !currentJobs().some((j) => j.videoId === videoId && isActive(j));
}

async function sweep(target: Sweep): Promise<void> {
  if (!maySweep(target)) return;
  await useLibrary.getState().load();
  // Both can change while the library loads.
  if (!maySweep(target)) return;
  for (const orphan of findOrphans(libraryTracks(), target.videoId, target.knownIds)) {
    // Checked one by one: a job can claim a song while an earlier one is being deleted.
    if (!target.claimed.has(orphan.id)) await useLibrary.getState().deleteTrack(orphan.id);
  }
}

/** Removes, a bit later, the song a canceled cloud save may have left behind. */
export function sweepAfterCancel(
  job: DownloadJob,
  knownIds: readonly string[],
  currentJobs: () => readonly DownloadJob[],
  watchJobs: WatchJobs,
): void {
  const home = cloudHome();
  if (!home) return;
  const claimed = new Set<string>();
  claimTracks(claimed, currentJobs());
  const stopWatching = watchJobs((jobs) => claimTracks(claimed, jobs));
  const target: Sweep = { videoId: job.videoId, home, knownIds, claimed, currentJobs };
  let passesLeft = SWEEP_DELAYS_MS.length;
  for (const delay of SWEEP_DELAYS_MS) {
    setTimeout(() => {
      sweep(target)
        .catch((err: unknown) => {
          console.error('Could not remove the song left by a canceled download', err);
        })
        .finally(() => {
          passesLeft -= 1;
          if (passesLeft === 0) stopWatching();
        });
    }, delay);
  }
}
