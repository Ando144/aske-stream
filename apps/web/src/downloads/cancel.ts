// Stopping jobs: the user's X, the stuck-save watchdog, and what has to be undone.
import { api } from '../api/client';
import { t } from '../i18n';
import { Downloader } from '../native/downloader';
// Circular import (that store creates these controls): only use it inside functions.
import { useDownloads } from '../stores/downloads';
import { useLibrary } from '../stores/library';
import { toast } from '../stores/ui';
import { endedPatch, isActive, sendOutcome, type DownloadsState } from './jobsStore';
import { snapshotKnownIds, sweepAfterCancel } from './orphans';
import { stuckSaving } from './pipeline';
import type { SaveOutcome } from './save';
import type { DownloadJob } from './types';

interface Store {
  get: () => DownloadsState;
  set: (patch: Partial<DownloadsState>) => void;
  update: (jobId: string, patch: Partial<DownloadJob>) => void;
}

const ack = (jobId: string) => Downloader.ack({ jobId }).catch(() => undefined);

const watchJobs = (onChange: (jobs: readonly DownloadJob[]) => void) =>
  useDownloads.subscribe((state) => onChange(state.jobs));

/** A save that ended although it had been stopped: its song must not stay in the library. */
export async function discardSaved(outcome: SaveOutcome): Promise<void> {
  if (outcome.kind === 'saved') await useLibrary.getState().deleteTrack(outcome.track.id);
}

/** Which jobs are being saved right now, each with the handle that can stop it. */
function createSaveLanes({ get, set }: Store) {
  const running = new Map<string, AbortController>();
  const others = (jobId: string) => get().saving.filter((id) => id !== jobId);

  /** Marks a job as being saved and returns the handle that can stop it. */
  function start(jobId: string): AbortController {
    const controller = new AbortController();
    running.set(jobId, controller);
    set({ saving: [...others(jobId), jobId] });
    return controller;
  }

  /** Frees the lane, unless a newer save of the same job (or a stop) already did. */
  function release(jobId: string, controller: AbortController): boolean {
    if (running.get(jobId) !== controller) return false;
    running.delete(jobId);
    set({ saving: others(jobId) });
    return true;
  }

  function abort(jobId: string) {
    const controller = running.get(jobId);
    if (!controller) return;
    // Released right away: a save that never answers must not keep its lane.
    release(jobId, controller);
    controller.abort();
  }

  return { start, release, abort };
}

export function createJobControls(store: Store) {
  const { get, update } = store;
  const { start, release, abort } = createSaveLanes(store);

  /** Tells the computer how a "Send to phone" item ended, once all its songs finished. */
  async function reportSend(sendId: string) {
    const outcome = sendOutcome(get().jobs.filter((j) => j.sendId === sendId));
    if (outcome)
      await api.sendUpdate(sendId, outcome.status, outcome.detail).catch(() => undefined);
  }

  /** Cancels one active job; true when it freed a save lane. Imports are settled by the caller. */
  async function cancel(jobId: string): Promise<boolean> {
    const before = get().jobs.find((j) => j.id === jobId);
    if (!before || !isActive(before)) return false;
    if (before.status === 'queued' || before.status === 'downloading') {
      await Downloader.cancel({ jobId }).catch(() => undefined);
    }
    // It may have moved on while the phone was answering.
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job || job.status === 'done' || job.status === 'skipped') return false;
    const wasSaving = job.status === 'saving';
    // Read before aborting: whatever appears afterwards was left behind by this save.
    const knownIds = wasSaving ? snapshotKnownIds(job.videoId) : null;
    abort(jobId);
    update(jobId, { status: 'canceled', error: undefined, finishedAt: Date.now() });
    if (knownIds) sweepAfterCancel(job, knownIds, () => get().jobs, watchJobs);
    if (wasSaving) toast(t('dl.toast.canceledSaving'));
    if (wasSaving || job.status === 'downloaded') await ack(jobId);
    if (job.sendId) await reportSend(job.sendId);
    return wasSaving;
  }

  /** Stops the saves that outlived their time limit. */
  function expireStuck(now: number) {
    for (const jobId of stuckSaving(get().jobs, now)) {
      const sendId = get().jobs.find((j) => j.id === jobId)?.sendId;
      abort(jobId);
      update(jobId, endedPatch(false, 'upload_timeout'));
      void ack(jobId);
      if (sendId) void reportSend(sendId);
    }
  }

  return { start, release, cancel, expireStuck, reportSend };
}
