import { useState } from 'react';
import { useT } from '../../i18n';
import { TOKEN_CREATE_URL } from '../../cloudflare/types';
import { ExternalButton, StepFrame } from './StepFrame';

const MIN_TOKEN_LENGTH = 30;

interface TokenStepProps {
  onSubmit: (token: string) => void;
  onBack: () => void;
}

export function TokenStep({ onSubmit, onBack }: TokenStepProps) {
  const t = useT();
  const [value, setValue] = useState('');
  const valid = value.trim().length >= MIN_TOKEN_LENGTH;

  const submit = () => {
    if (!valid) return;
    const token = value.trim();
    // Do not keep the key in the screen state once it has been handed over.
    setValue('');
    onSubmit(token);
  };

  return (
    <StepFrame title={t('cfsetup.token.title')} onBack={onBack} helpId="cloudflare-token">
      <p>{t('cfsetup.token.what')}</p>
      <ExternalButton href={TOKEN_CREATE_URL} label={t('cfsetup.token.open')} />
      <ol className="cfsetup-list">
        <li>{t('cfsetup.token.step1')}</li>
        <li>{t('cfsetup.token.step2')}</li>
        <li>{t('cfsetup.token.step3')}</li>
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="cf-token" className="small muted">
          {t('cfsetup.token.label')}
        </label>
        <input
          id="cf-token"
          className="input"
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={!valid}>
          {t('cfsetup.token.submit')}
        </button>
      </form>
    </StepFrame>
  );
}
