import { useEffect, useState } from 'react';
import { ChevronLeft, LoaderCircle } from 'lucide-react';
import { HelpButton } from '../components/HelpSheet';
import { JamRoom } from '../components/jam/JamRoom';
import { JamStart } from '../components/jam/JamStart';
import { useT, type MessageKey, type Translate } from '../i18n';
import { jamEn } from '../i18n/jam';
import { hubAvailable } from '../hub/client';
import { useJam } from '../stores/jam';
import { useSetup } from '../stores/setup';

export const PENDING_JAM_KEY = 'pending-jam';

function errorText(t: Translate, code: string): string {
  const own = `jam.err.${code}`;
  return t((own in jamEn ? own : `hub.err.${code}`) as MessageKey);
}

function EndedNotice({ reason }: { reason: 'host' | 'expired' }) {
  const t = useT();
  return (
    <div className="jam-card">
      <p>{t(reason === 'host' ? 'jam.ended.host' : 'jam.ended.expired')}</p>
      <button className="btn primary" onClick={() => useJam.getState().leave()}>
        {t('jam.ended.back')}
      </button>
    </div>
  );
}

function JamBody({ hasLibrary }: { hasLibrary: boolean }) {
  const t = useT();
  const session = useJam((s) => s.session);
  const connection = useJam((s) => s.connection);
  const endedReason = useJam((s) => s.endedReason);
  const [initialCode] = useState(() => sessionStorage.getItem(PENDING_JAM_KEY) ?? '');

  useEffect(() => {
    if (session) sessionStorage.removeItem(PENDING_JAM_KEY);
  }, [session]);

  if (endedReason) return <EndedNotice reason={endedReason} />;
  if (session) return <JamRoom hasLibrary={hasLibrary} />;
  if (connection === 'connecting') {
    return (
      <p className="muted">
        <LoaderCircle size={16} className="spin" /> {t('jam.connecting')}
      </p>
    );
  }
  return <JamStart initialCode={initialCode} />;
}

/**
 * The Jam screen. With `onExit` it is shown full screen before the app is set up, so a friend
 * who opened a Jam link can join without configuring anything.
 */
export function JamView({ onExit }: { onExit?: () => void }) {
  const t = useT();
  const error = useJam((s) => s.error);
  const ready = useSetup((s) => s.status === 'ready');

  useEffect(() => {
    if (onExit) void useJam.getState().resume();
  }, [onExit]);

  return (
    <div className="page">
      {onExit && (
        <button className="icon-btn" onClick={onExit} aria-label={t('shared.back')}>
          <ChevronLeft size={24} />
        </button>
      )}
      <header className="page-header">
        <h1>{t('jam.title')}</h1>
        <div className="header-actions">
          <HelpButton id="jam" label={t('jam.help')} />
        </div>
      </header>
      {!hubAvailable() ? (
        <p className="error-text">{t('hub.err.unavailable')}</p>
      ) : (
        <>
          {error && (
            <div className="error-text">
              {errorText(t, error)}{' '}
              <button className="help-link" onClick={() => useJam.getState().clearError()}>
                {t('jam.dismissError')}
              </button>
            </div>
          )}
          <JamBody hasLibrary={ready && !onExit} />
        </>
      )}
    </div>
  );
}
