import { Lightbulb } from 'lucide-react';
import { useT, type MessageKey } from '../i18n';
import { useTips } from '../stores/tips';
import { HelpButton } from './HelpSheet';

/**
 * A short explanation shown the first times you open a screen, with a link
 * to the full help article. "Got it" hides it for good.
 */
export function ScreenTip({ id, text, helpId }: { id: string; text: MessageKey; helpId: string }) {
  const t = useT();
  const hidden = useTips((s) => s.dismissed.includes(id));
  if (hidden) return null;
  return (
    <div className="banner screen-tip" role="note">
      <Lightbulb size={18} color="var(--accent)" />
      <div className="grow">
        <div className="small">{t(text)}</div>
        <div className="row small screen-tip-actions">
          <HelpButton id={helpId} />
          <button className="btn small" onClick={() => useTips.getState().dismiss(id)}>
            {t('tips.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}
