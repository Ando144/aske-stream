import { ApiError } from '../api/client';
import { t } from '../i18n';
import { useServerUpdate } from './serverUpdate';
import { toast } from './ui';

/** `reload` resyncs the library when the server no longer knows something we show. */
export function reportError(err: unknown, reload: () => Promise<void>) {
  if (err instanceof Error && err.message === 'cloudflare_outdated') {
    useServerUpdate.getState().markOutdated();
    toast(t('toast.serverOutdated'), 'error');
    return;
  }
  if (err instanceof Error && err.message === 'folder_not_found') {
    void reload();
    toast(t('toast.error'), 'error');
    return;
  }
  if (err instanceof ApiError && err.status === 0) toast(t('toast.offline'), 'error');
  else if (err instanceof ApiError && err.status !== 401) toast(err.message, 'error');
  else if (!(err instanceof ApiError)) toast(t('toast.error'), 'error');
}

/** `mutate` already reported generic errors; add the specific pin message unless outdated. */
export function reportPinError(err: unknown) {
  if (err instanceof Error && err.message === 'cloudflare_outdated') return;
  toast(t('toast.pinFailed'), 'error');
}

export function isStorageFull(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 507 || err.code === 'storage_full';
  return err instanceof Error && err.message.includes('storage_full');
}
