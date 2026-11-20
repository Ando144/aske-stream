import { useT } from '../../i18n';
import type { SetupMode } from '../../stores/cloudflareSetup';
import { ExternalButton, StepFrame } from './StepFrame';

const TOKENS_URL = 'https://dash.cloudflare.com/profile/api-tokens';

export function DoneStep({ mode, onFinish }: { mode: SetupMode; onFinish: () => void }) {
  const t = useT();
  const update = mode === 'update';
  return (
    <StepFrame title={t(update ? 'cfsetup.done.updateTitle' : 'cfsetup.done.title')}>
      <p>{t(update ? 'cfsetup.done.updateText' : 'cfsetup.done.text')}</p>
      <ExternalButton href={TOKENS_URL} label={t('cfsetup.done.deleteToken')} />
      <button type="button" className="btn" onClick={onFinish}>
        {t('cfsetup.done.finish')}
      </button>
    </StepFrame>
  );
}
