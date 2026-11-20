import { t, type MessageKey } from '../i18n';
import { shareEn } from '../i18n/share';
import { HubError } from './client';

/** Plain-language text for any Hub failure. Unknown errors are logged and shown as generic. */
export function hubErrorText(err: unknown): string {
  if (err instanceof HubError) {
    const key = `hub.err.${err.code}`;
    if (key in shareEn) return t(key as MessageKey);
  }
  console.error('Unexpected Hub error', err);
  return t('hub.err.internal_error');
}
