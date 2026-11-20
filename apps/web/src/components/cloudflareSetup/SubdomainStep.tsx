import { useState } from 'react';
import { useT } from '../../i18n';
import { workerUrl } from '../../cloudflare/deploy';
import { StepFrame } from './StepFrame';

interface SubdomainStepProps {
  suggested: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function SubdomainStep({ suggested, onSubmit, onCancel }: SubdomainStepProps) {
  const t = useT();
  const [name, setName] = useState(suggested);
  const clean = name.trim().toLowerCase();
  return (
    <StepFrame title={t('cfsetup.subdomain.title')} onBack={onCancel} helpId="cloudflare-setup">
      <p>{t('cfsetup.subdomain.text')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (clean) onSubmit(clean);
        }}
      >
        <label htmlFor="cf-subdomain" className="small muted">
          {t('cfsetup.subdomain.label')}
        </label>
        <input
          id="cf-subdomain"
          className="input"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {clean && (
          <span className="faint small">
            {t('cfsetup.subdomain.preview', { address: workerUrl(clean) })}
          </span>
        )}
        <button className="btn primary" type="submit" disabled={!clean}>
          {t('cfsetup.subdomain.submit')}
        </button>
      </form>
    </StepFrame>
  );
}
