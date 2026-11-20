import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import type { SetupErrorCode } from '../../cloudflare/setup';
import { useCloudflareSetup } from '../../stores/cloudflareSetup';
import { StepFrame } from './StepFrame';

/** Each error offers the button that leads to the screen where it is fixed. */
function retryLabel(error: SetupErrorCode): MessageKey {
  if (error === 'not_live_yet') return 'cfsetup.error.waitRetry';
  if (error === 'r2_not_enabled') return 'cfsetup.error.goR2';
  if (error === 'invalid_token' || error === 'missing_permission') return 'cfsetup.error.goToken';
  if (error === 'subdomain_taken') return 'cfsetup.error.otherName';
  return 'cfsetup.error.retry';
}

export function ErrorStep({ error, onCancel }: { error: SetupErrorCode; onCancel: () => void }) {
  const t = useT();
  const fix = async () => {
    await useCloudflareSetup.getState().retry();
    // retry() lands on the token screen; the R2 screen is the one right before it.
    if (error === 'r2_not_enabled') useCloudflareSetup.getState().back();
  };
  return (
    <StepFrame title={t('cfsetup.error.title')} helpId="cloudflare-setup">
      <p className="error-text">{t(`cfsetup.error.${error}`)}</p>
      <button type="button" className="btn primary" onClick={() => void fix()}>
        {t(retryLabel(error))}
      </button>
      <button type="button" className="btn" onClick={onCancel}>
        {t('cfsetup.cancel')}
      </button>
    </StepFrame>
  );
}
