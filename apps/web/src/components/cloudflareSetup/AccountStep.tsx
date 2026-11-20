import { useT } from '../../i18n';
import { ExternalButton, StepFrame } from './StepFrame';

const SIGN_UP_URL = 'https://dash.cloudflare.com/sign-up';

export function AccountStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const t = useT();
  return (
    <StepFrame title={t('cfsetup.account.title')} onBack={onBack} helpId="cloudflare-setup">
      <p>{t('cfsetup.account.text')}</p>
      <ExternalButton href={SIGN_UP_URL} label={t('cfsetup.account.open')} />
      <button type="button" className="btn" onClick={onNext}>
        {t('cfsetup.account.have')}
      </button>
    </StepFrame>
  );
}
