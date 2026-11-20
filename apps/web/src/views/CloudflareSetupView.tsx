import { useEffect } from 'react';
import { AccountStep } from '../components/cloudflareSetup/AccountStep';
import { ChooseAccountStep } from '../components/cloudflareSetup/ChooseAccountStep';
import { ConfirmExistingStep } from '../components/cloudflareSetup/ConfirmExistingStep';
import { DoneStep } from '../components/cloudflareSetup/DoneStep';
import { ErrorStep } from '../components/cloudflareSetup/ErrorStep';
import { IntroStep } from '../components/cloudflareSetup/IntroStep';
import { R2Step } from '../components/cloudflareSetup/R2Step';
import { RunningStep } from '../components/cloudflareSetup/RunningStep';
import { SubdomainStep } from '../components/cloudflareSetup/SubdomainStep';
import { TokenStep } from '../components/cloudflareSetup/TokenStep';
import { useCloudflareSetup, type SetupMode } from '../stores/cloudflareSetup';

interface CloudflareSetupViewProps {
  mode: SetupMode;
  /** Called after the assistant is closed (finished or cancelled). */
  onExit?: () => void;
}

/** Assistant that sets up (or updates) the user's own Cloudflare server from the Android app. */
export function CloudflareSetupView({ mode, onExit }: CloudflareSetupViewProps) {
  const s = useCloudflareSetup();

  useEffect(() => {
    useCloudflareSetup.getState().start(mode);
    // The setup mode is closed by the status in the setup store; only the update screen
    // lives inside the app and must drop its secrets when the user leaves it.
    return () => {
      if (mode === 'update') useCloudflareSetup.getState().cancel();
    };
  }, [mode]);

  const exit = () => {
    useCloudflareSetup.getState().cancel();
    onExit?.();
  };

  switch (s.phase) {
    case 'intro':
      return <IntroStep mode={mode} onNext={s.next} onBack={exit} />;
    case 'account':
      return <AccountStep onNext={s.next} onBack={s.back} />;
    case 'r2':
      return <R2Step onNext={s.next} onBack={s.back} />;
    case 'token':
      return <TokenStep onSubmit={(token) => void s.submitToken(token)} onBack={s.back} />;
    case 'chooseAccount':
      return (
        <ChooseAccountStep
          accounts={s.accounts}
          onPick={(id) => void s.pickAccount(id)}
          onCancel={exit}
        />
      );
    case 'chooseSubdomain':
      return (
        <SubdomainStep
          suggested={s.suggestedSubdomain}
          onSubmit={(name) => void s.chooseSubdomain(name)}
          onCancel={exit}
        />
      );
    case 'confirmExisting':
      return <ConfirmExistingStep onConfirm={() => void s.confirmExisting()} onCancel={exit} />;
    case 'running':
      return <RunningStep mode={mode} step={s.step} />;
    case 'done':
      return <DoneStep mode={mode} onFinish={exit} />;
    case 'error':
      return <ErrorStep error={s.error ?? 'unknown'} onCancel={exit} />;
  }
}
