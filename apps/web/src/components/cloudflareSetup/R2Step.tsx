import { useT } from '../../i18n';
import { ExternalButton, StepFrame } from './StepFrame';

const R2_URL = 'https://dash.cloudflare.com/?to=/:account/r2/overview';

export function R2Step({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const t = useT();
  return (
    <StepFrame title={t('cfsetup.r2.title')} onBack={onBack} helpId="cloudflare-setup">
      <p>{t('cfsetup.r2.text')}</p>
      <ExternalButton href={R2_URL} label={t('cfsetup.r2.open')} />
      <button type="button" className="btn" onClick={onNext}>
        {t('cfsetup.r2.done')}
      </button>
    </StepFrame>
  );
}
