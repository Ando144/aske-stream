import { useT } from '../../i18n';
import { StepFrame } from './StepFrame';

export function ConfirmExistingStep({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <StepFrame title={t('cfsetup.existing.title')} onBack={onCancel}>
      <p>{t('cfsetup.existing.text')}</p>
      <button type="button" className="btn primary" onClick={onConfirm}>
        {t('cfsetup.existing.confirm')}
      </button>
    </StepFrame>
  );
}
