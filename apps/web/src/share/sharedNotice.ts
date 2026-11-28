import { isActive } from '../downloads/jobsStore';
import type { DownloadJob } from '../downloads/types';
import type { MessageKey } from '../i18n';

/** The notice after sharing a video; nothing queued means it is on its way or already saved. */
export function sharedNoticeKey(
  queued: number,
  videoId: string,
  jobs: readonly DownloadJob[],
): MessageKey {
  if (queued > 0) return 'shareIn.added';
  const onItsWay = jobs.some((j) => j.videoId === videoId && isActive(j));
  return onItsWay ? 'shareIn.alreadyQueued' : 'shareIn.alreadyHad';
}
