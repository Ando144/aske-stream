import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import { articleById } from '../help/articles';
import { HelpBody } from '../help/HelpBody';
import { useI18n, useT } from '../i18n';

/**
 * A help article in a sheet, usable anywhere — also on the setup and
 * connection screens, before the rest of the app exists.
 */
export function HelpSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [history, setHistory] = useState<string[]>([id]);
  const article = articleById(history[history.length - 1]!);
  if (!article) return null;
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div
        className="sheet help-sheet"
        role="dialog"
        aria-modal
        aria-label={article.title[language]}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row">
          {history.length > 1 ? (
            <button
              className="icon-btn"
              aria-label={t('common.back')}
              onClick={() => setHistory(history.slice(0, -1))}
            >
              <ArrowLeft size={20} />
            </button>
          ) : null}
          <h2 className="grow">{article.title[language]}</h2>
          <button className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <HelpBody text={article.body[language]} onOpen={(to) => setHistory([...history, to])} />
      </div>
    </div>,
    document.body,
  );
}

/** A small "Learn more" link that opens an article in a sheet. */
export function HelpButton({ id, label }: { id: string; label?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="help-link" onClick={() => setOpen(true)}>
        {label ?? t('help.learnMore')}
      </button>
      {open && <HelpSheet id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
