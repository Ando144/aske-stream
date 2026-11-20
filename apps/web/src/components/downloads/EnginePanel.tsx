import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useT } from '../../i18n';
import { useDownloads } from '../../stores/downloads';

export function EnginePanel() {
  const t = useT();
  const engine = useDownloads((s) => s.engine);
  const busy = engine.status === 'starting' || engine.status === 'updating';
  return (
    <div className="panel dl-engine small">
      <div className="grow">
        <div>
          {t('dl.engine')}
          {engine.version ? ` · ${engine.version}` : ''}
        </div>
        <div className="faint">
          {engine.status === 'error' ? t('dl.engineError') : t('dl.engineHint')}
        </div>
      </div>
      <button
        className="btn small"
        disabled={busy}
        onClick={() => void useDownloads.getState().updateEngine(true)}
      >
        {busy ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
        {engine.status === 'updating' ? t('dl.engineUpdating') : t('dl.engineUpdate')}
      </button>
    </div>
  );
}
