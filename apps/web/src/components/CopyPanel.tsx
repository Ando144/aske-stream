import { useEffect } from 'react';
import { ArrowRightLeft, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useT, type Translate } from '../i18n';
import { formatBytes } from '../lib/format';
import { getDriveToken } from '../storage/drive/auth';
import type { Destination } from '../storage/types';
import { useCopy, type CopyJob } from '../stores/copy';
import { toast } from '../stores/ui';
import { HelpButton } from './HelpSheet';

const place = (t: Translate, kind: Destination) => t(`copy.place.${kind}`);

function Places({ job }: { job: CopyJob }) {
  const t = useT();
  return (
    <>
      <p className="small">{t('copy.from', { place: place(t, job.from) })}</p>
      <p className="small">{t('copy.to', { place: place(t, job.to) })}</p>
    </>
  );
}

function Offered({ job }: { job: CopyJob }) {
  const t = useT();
  const { unsupported } = job.progress;
  return (
    <>
      <Places job={job} />
      <p className="small">{t('copy.offer', { count: job.pendingCount })}</p>
      <p className="faint small">{t('copy.explain')}</p>
      {unsupported > 0 && (
        <p className="faint small">{t('copy.unsupported', { count: unsupported })}</p>
      )}
      {job.missingBytes > 0 && (
        <div className="banner small">
          <TriangleAlert size={16} />{' '}
          {t('copy.notEnoughSpace', { size: formatBytes(job.missingBytes) })}
        </div>
      )}
      <div className="row">
        <button
          className="btn primary small"
          disabled={!navigator.onLine}
          onClick={() => void useCopy.getState().start()}
        >
          {t('copy.start')}
        </button>
        <button className="btn small" onClick={() => void useCopy.getState().dismiss()}>
          {t('copy.later')}
        </button>
        <HelpButton id="storage-copy" />
      </div>
    </>
  );
}

function Running({ job }: { job: CopyJob }) {
  const t = useT();
  const { done, total } = job.progress;
  return (
    <>
      <Places job={job} />
      <p className="small">{t('copy.progress', { done, total })}</p>
      <div className="meter" aria-hidden>
        <div
          className="auto"
          style={{ width: `${total ? Math.max(2, (done / total) * 100) : 2}%` }}
        />
      </div>
      <p className="faint small">{t('copy.keepOpen')}</p>
      <div className="row">
        <button className="btn small" onClick={() => useCopy.getState().stop()}>
          <LoaderCircle size={16} className="spin" /> {t('copy.cancel')}
        </button>
        <HelpButton id="storage-copy" />
      </div>
    </>
  );
}

function Paused({ job }: { job: CopyJob }) {
  const t = useT();
  const needsGoogle = job.stopped === 'auth' && (job.from === 'drive' || job.to === 'drive');

  async function reconnect() {
    try {
      await getDriveToken(true);
      void useCopy.getState().start();
    } catch (err) {
      console.warn('Google reconnection failed', err);
      toast(t('copy.stopped.auth'));
    }
  }

  return (
    <>
      <Places job={job} />
      {job.stopped && (
        <div className="banner small">
          <TriangleAlert size={16} /> {t(`copy.stopped.${job.stopped}`)}
        </div>
      )}
      <p className="small">
        {t('copy.progress', { done: job.progress.done, total: job.progress.total })}
      </p>
      <div className="row">
        {needsGoogle && (
          <button className="btn primary small" onClick={() => void reconnect()}>
            {t('copy.reconnectGoogle')}
          </button>
        )}
        <button
          className={needsGoogle ? 'btn small' : 'btn primary small'}
          disabled={!navigator.onLine}
          onClick={() => void useCopy.getState().start()}
        >
          {t('copy.resume')}
        </button>
        <HelpButton id="storage-copy" />
      </div>
    </>
  );
}

function Done({ job }: { job: CopyJob }) {
  const t = useT();
  const { copied, already, unsupported, failed, playlistOverflow } = job.progress;
  return (
    <>
      <p className="small">{t('copy.done', { copied, already })}</p>
      {unsupported > 0 && <p className="small">{t('copy.unsupported', { count: unsupported })}</p>}
      {failed.length > 0 && (
        <div className="banner small">
          <TriangleAlert size={16} /> {t('copy.failed', { count: failed.length })}
        </div>
      )}
      {playlistOverflow.map((o) => (
        <p key={o.name} className="small">
          {t('copy.playlistFull', { name: o.name, count: o.count })}
        </p>
      ))}
      <div className="row">
        {failed.length > 0 && (
          <button
            className="btn primary small"
            disabled={!navigator.onLine}
            onClick={() => void useCopy.getState().start()}
          >
            {t('copy.resume')}
          </button>
        )}
        <button
          className={failed.length > 0 ? 'btn small' : 'btn primary small'}
          onClick={() => void useCopy.getState().dismiss()}
        >
          {t('copy.close')}
        </button>
        <HelpButton id="storage-copy" />
      </div>
    </>
  );
}

/**
 * Asks whether to copy music from one storage to another and shows the
 * progress. In the library (`compact`) it only appears when there is
 * something offered or in progress.
 */
export function CopyPanel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const job = useCopy((s) => s.job);

  useEffect(() => {
    void useCopy.getState().restore();
  }, []);

  if (!job || job.status === 'dismissed') return null;
  if (compact && job.status === 'done') return null;

  return (
    <div className="panel copy-drive">
      <div className="row">
        <ArrowRightLeft size={22} className="muted" />
        <strong className="grow">{t('copy.title')}</strong>
      </div>
      {job.status === 'offered' && <Offered job={job} />}
      {job.status === 'running' && <Running job={job} />}
      {job.status === 'paused' && <Paused job={job} />}
      {job.status === 'done' && <Done job={job} />}
    </div>
  );
}
