import { Check, Circle, LoaderCircle } from 'lucide-react';
import { useT } from '../../i18n';
import type { SetupStep } from '../../cloudflare/setup';
import type { SetupMode } from '../../stores/cloudflareSetup';
import { StepFrame } from './StepFrame';

export const RUNNING_STEPS: Record<SetupMode, SetupStep[]> = {
  setup: [
    'account',
    'subdomain',
    'storage',
    'database',
    'migrations',
    'files',
    'worker',
    'publish',
    'waiting',
  ],
  update: ['account', 'database', 'migrations', 'files', 'worker', 'waiting'],
};

export function RunningStep({ mode, step }: { mode: SetupMode; step: SetupStep | null }) {
  const t = useT();
  const steps = RUNNING_STEPS[mode];
  const current = step === null ? 0 : steps.indexOf(step);
  const title = mode === 'update' ? 'cfsetup.running.updateTitle' : 'cfsetup.running.title';
  return (
    <StepFrame title={t(title)}>
      <p className="muted">{t('cfsetup.running.text')}</p>
      <ul className="cfsetup-progress" aria-live="polite">
        {steps.map((s, i) => (
          <li key={s} className={i === current ? 'current' : i < current ? 'done' : 'pending'}>
            {i < current && <Check size={16} color="var(--accent)" />}
            {i === current && <LoaderCircle size={16} className="spin" color="var(--accent)" />}
            {i > current && <Circle size={16} className="faint" />}
            <span>{t(`cfsetup.step.${s}`)}</span>
          </li>
        ))}
      </ul>
    </StepFrame>
  );
}
