import { t } from '../i18n';
import { Downloader } from '../native/downloader';
import {
  buildNotification,
  createBatchTracker,
  doneNotice,
  nextSendDelay,
  shouldSend,
  type SentNotification,
  type Translate,
} from './notification';
import type { DownloadJob, NotificationTemplates } from './types';

const tr = t as Translate; // plain-string keys for the pure helpers

const warn = (err: unknown) => console.warn('notification', err);

/** Texts the phone fills in itself while the app is closed. */
const notificationTemplates = (): NotificationTemplates => ({
  progress: t('dl.notifTitle', { done: '{done}', total: '{total}' }),
  waiting: t('dl.notifWaiting'),
  openToSave: t('dl.notifOpenToSave', { count: '{count}' }),
  openToSaveOne: t('dl.notifOpenToSave', { count: 1 }),
  paused: t('dl.notifPaused'),
});

interface NotifierDeps {
  getJobs: () => DownloadJob[];
  getWaitingNetwork: () => boolean;
}

export function createDownloadNotifier({ getJobs, getWaitingNetwork }: NotifierDeps) {
  /** Last notice sent, and the timer of one held back by the rate limit (the latest wins). */
  let lastSent: SentNotification | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | undefined;
  const batches = createBatchTracker();

  /** The queue is empty: close the progress notice and, if songs finished, show the final one. */
  function endNotification() {
    if (!lastSent) return;
    lastSent = null;
    const doneText = doneNotice(batches.take(getJobs(), Date.now()), tr) ?? undefined;
    void Downloader.setNotification({ active: false, doneText }).catch(warn);
  }

  function notify() {
    clearTimeout(sendTimer);
    const content = buildNotification(
      getJobs(),
      getWaitingNetwork(),
      tr,
      lastSent?.content.progress ?? 0,
    );
    if (!content) return endNotification();
    batches.collect(getJobs());
    const now = Date.now();
    if (shouldSend(lastSent, content, now)) {
      lastSent = { content, at: now };
      void Downloader.setNotification({ active: true, ...content }).catch(warn);
    } else if (lastSent) {
      sendTimer = setTimeout(notify, nextSendDelay(lastSent, content, now));
    }
  }

  return { notify, templates: notificationTemplates };
}
