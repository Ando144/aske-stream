import { t } from '../i18n';
import { DriveAuthRequired } from '../storage/drive/auth';

/** Turns yt-dlp's English errors into something the user can act on. */
export function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('storage is full') || m.includes('storage_full')) return t('dl.err.cloudFull');
  if (m.includes('drive_full')) return t('dl.err.driveFull');
  if (m.includes('drive_auth')) return t('dl.err.driveAuth');
  if (m.includes('quota') || m.includes('no space') || m.includes('enospc'))
    return t('dl.err.phoneFull');
  if (m.includes('confirm you') && m.includes('bot')) return t('dl.err.bot');
  if (m.includes('private video') || m.includes('unavailable') || m.includes('removed'))
    return t('dl.err.unavailable');
  if (m.includes('age') && m.includes('sign in')) return t('dl.err.age');
  if (m.includes('copyright') || m.includes('not available in your country'))
    return t('dl.err.blocked');
  if (
    m.includes('network') ||
    m.includes('timed out') ||
    m.includes('unable to download') ||
    m.includes('connection') ||
    m.includes('no connection')
  )
    return t('dl.err.network');
  if (m.includes('too large') || m.includes('too big')) return t('dl.err.tooBig');
  return t('dl.err.generic');
}

/** Raw text that `friendlyError` understands for a failed save. */
export function saveErrorText(err: unknown): string {
  const code = (err as { code?: string }).code;
  if (code === 'drive_full' || err instanceof DriveAuthRequired) {
    return code ?? 'drive_auth';
  }
  return String((err as Error)?.message ?? err);
}
