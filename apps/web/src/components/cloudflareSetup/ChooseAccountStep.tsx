import { useT } from '../../i18n';
import type { CfAccount } from '../../stores/cloudflareSetup';
import { StepFrame } from './StepFrame';

interface ChooseAccountStepProps {
  accounts: CfAccount[];
  onPick: (id: string) => void;
  onCancel: () => void;
}

export function ChooseAccountStep({ accounts, onPick, onCancel }: ChooseAccountStepProps) {
  const t = useT();
  return (
    <StepFrame title={t('cfsetup.chooseAccount.title')} onBack={onCancel}>
      <p>{t('cfsetup.chooseAccount.text')}</p>
      {accounts.map((a) => (
        <button key={a.id} type="button" className="btn" onClick={() => onPick(a.id)}>
          {a.name}
        </button>
      ))}
    </StepFrame>
  );
}
