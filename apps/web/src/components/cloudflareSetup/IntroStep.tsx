import { useT } from '../../i18n';
import type { SetupMode } from '../../stores/cloudflareSetup';
import { StepFrame } from './StepFrame';

interface IntroStepProps {
  mode: SetupMode;
  onNext: () => void;
  onBack: () => void;
}

export function IntroStep({ mode, onNext, onBack }: IntroStepProps) {
  const t = useT();
  const update = mode === 'update';
  return (
    <StepFrame
      title={t(update ? 'cfsetup.updateTitle' : 'cfsetup.title')}
      onBack={onBack}
      helpId={update ? 'cloudflare-update' : 'cloudflare-setup'}
    >
      {update ? (
        <>
          <p>{t('cfsetup.updateIntro.what')}</p>
          <p className="muted">{t('cfsetup.updateIntro.time')}</p>
        </>
      ) : (
        <>
          <p>{t('cfsetup.intro.what')}</p>
          <p className="muted">{t('cfsetup.intro.free')}</p>
          <p className="muted">{t('cfsetup.intro.card')}</p>
          <p className="muted">{t('cfsetup.intro.time')}</p>
        </>
      )}
      <button type="button" className="btn primary" onClick={onNext}>
        {t(update ? 'cfsetup.next' : 'cfsetup.intro.start')}
      </button>
    </StepFrame>
  );
}
