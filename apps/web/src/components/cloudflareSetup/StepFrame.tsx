import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { HelpButton } from '../HelpSheet';
import { useT } from '../../i18n';

interface StepFrameProps {
  title: string;
  children: ReactNode;
  /** Shows the "Back" button when given. */
  onBack?: () => void;
  /** Help article linked at the bottom. */
  helpId?: string;
}

/** Common layout of every assistant screen: title, content, back button and help link. */
export function StepFrame({ title, children, onBack, helpId }: StepFrameProps) {
  const t = useT();
  return (
    <div className="center-screen">
      <div className="cfsetup">
        <h1>{title}</h1>
        {children}
        {helpId && <HelpButton id={helpId} label={t('cfsetup.help')} />}
        {onBack && (
          <button type="button" className="btn" onClick={onBack}>
            <ArrowLeft size={16} /> {t('cfsetup.back')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Opens an outside page (Cloudflare) in the browser. */
export function ExternalButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="btn primary" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}
