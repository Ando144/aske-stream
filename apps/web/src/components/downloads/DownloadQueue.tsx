import { useState } from 'react';
import { Check, CircleAlert, RotateCcw, Trash2, X } from 'lucide-react';
import { BIG_AUDIO_BYTES } from '../../downloads/pipeline';
import { useT } from '../../i18n';
import { formatBytes } from '../../lib/format';
import { useDownloads, type DownloadJob } from '../../stores/downloads';
import { SongThumb } from '../SongThumb';
import { BatteryHint } from './BatteryHint';
import { NetworkBanner } from './NetworkBanner';

const ACTIVE = ['queued', 'downloading', 'downloaded', 'saving'];

export function statusText(
  t: ReturnType<typeof useT>,
  j: DownloadJob,
  waitingNetwork = false,
  now = Date.now(),
): string {
  if (j.status === 'downloaded' && j.retryAt && j.retryAt > now) return t('dl.st.retrying');
  const onPhone = j.target === 'device-only';
  const bytes = j.file?.bytes ?? 0;
  if (waitingNetwork && ACTIVE.includes(j.status) && j.status !== 'saving' && !onPhone) {
    return t('dl.st.waitingNetwork');
  }
  switch (j.status) {
    case 'queued':
      return t('dl.st.queued');
    case 'downloading':
      return t('dl.st.downloading', { percent: Math.round(j.progress) });
    case 'saving':
      if (onPhone) return t('dl.st.savingLocal', { size: formatBytes(bytes) });
      if (bytes > BIG_AUDIO_BYTES) return t('dl.st.savingBig', { size: formatBytes(bytes) });
      return t('dl.st.saving');
    case 'downloaded':
      return t('dl.st.downloaded');
    case 'done':
      return onPhone ? t('dl.st.savedLocal') : t('dl.st.done');
    case 'skipped':
      return t('dl.st.skipped');
    case 'canceled':
      return t('dl.st.canceled');
    default:
      return j.error ?? t('dl.err.generic');
  }
}

export function Queue() {
  const t = useT();
  const jobs = useDownloads((s) => s.jobs);
  const [showDone, setShowDone] = useState(false);

  const active = jobs.filter((j) => ACTIVE.includes(j.status));
  const failed = jobs.filter((j) => j.status === 'error');
  const finished = jobs.filter((j) => !active.includes(j) && j.status !== 'error').reverse();

  return (
    <>
      {active.length > 0 && <NetworkBanner />}
      {active.length > 0 && <BatteryHint />}
      {(active.length > 0 || failed.length > 0) && (
        <section>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title">
              {active.length ? t('dl.queueTitle', { count: active.length }) : t('dl.failedTitle')}
            </h2>
            <div className="row">
              {failed.length > 0 && (
                <button className="btn small" onClick={() => useDownloads.getState().retryFailed()}>
                  <RotateCcw size={16} /> {t('dl.retryAll')}
                </button>
              )}
              {active.length > 0 && (
                <button
                  className="btn small"
                  onClick={() => void useDownloads.getState().cancelAll()}
                >
                  <X size={16} /> {t('dl.cancelAll')}
                </button>
              )}
            </div>
          </div>
          <div className="card-list">
            {[...active, ...failed].map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="section-title link-btn" onClick={() => setShowDone(!showDone)}>
              {t('dl.finishedTitle', { count: finished.length })} {showDone ? '▾' : '▸'}
            </button>
            <button
              className="btn small"
              onClick={() => void useDownloads.getState().clearFinished()}
            >
              <Trash2 size={16} /> {t('dl.clearList')}
            </button>
          </div>
          {showDone && (
            <div className="card-list">
              {finished.slice(0, 100).map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

/** `canceling` is true while the phone answers the cancel request. */
function useCancel(jobId: string) {
  const [canceling, setCanceling] = useState(false);
  const cancel = () => {
    setCanceling(true);
    void useDownloads
      .getState()
      .cancel(jobId)
      .finally(() => setCanceling(false));
  };
  return { canceling, cancel };
}

export function JobRow({ job }: { job: DownloadJob }) {
  const t = useT();
  const waitingNetwork = useDownloads((s) => s.waitingNetwork);
  const preparing = useDownloads(
    (s) =>
      job.status === 'queued' &&
      (s.engine.status === 'starting' || s.engine.status === 'updating') &&
      s.jobs.find((j) => j.status === 'queued')?.id === job.id,
  );
  const { canceling, cancel } = useCancel(job.id);
  const active = ACTIVE.includes(job.status);
  // Errors and the explanation of a long save must be readable in full.
  const wraps = job.status === 'error' || job.status === 'saving';
  const status = () => {
    if (canceling && active) return t('dl.st.canceling');
    return preparing ? t('dl.st.preparing') : statusText(t, job, waitingNetwork);
  };
  return (
    <div className={`card-row dl-job ${job.status}`}>
      <SongThumb
        src={job.thumbnail}
        videoId={job.videoId}
        title={job.title}
        artist={job.author}
        size={0}
        className="dl-thumb"
      />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="card-title ellipsis">{job.title}</div>
        <div
          className={`small ${job.status === 'error' ? 'error-text' : 'muted'}${wraps ? '' : ' ellipsis'}`}
        >
          {job.status === 'error' && <CircleAlert size={12} />} {status()}
        </div>
        {job.status === 'downloading' && (
          <div className="meter dl-meter" aria-hidden>
            <div className="auto" style={{ width: `${job.progress}%` }} />
          </div>
        )}
      </div>
      <JobActions job={job} active={active} onCancel={cancel} />
    </div>
  );
}

function JobActions(props: { job: DownloadJob; active: boolean; onCancel: () => void }) {
  const t = useT();
  const { job, active, onCancel } = props;
  if (active) {
    return (
      <button className="icon-btn" aria-label={t('common.cancel')} onClick={onCancel}>
        <X size={20} />
      </button>
    );
  }
  if (job.status !== 'error' && job.status !== 'canceled') {
    return <Check size={20} color="var(--accent)" />;
  }
  return (
    <>
      <button
        className="icon-btn"
        aria-label={t('dl.retry')}
        onClick={() => useDownloads.getState().retry(job.id)}
      >
        <RotateCcw size={20} />
      </button>
      <button
        className="icon-btn"
        aria-label={t('dl.remove')}
        title={t('dl.remove')}
        onClick={() => void useDownloads.getState().remove(job.id)}
      >
        <Trash2 size={20} />
      </button>
    </>
  );
}
