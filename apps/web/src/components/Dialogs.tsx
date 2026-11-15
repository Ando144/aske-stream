import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useUi } from '../stores/ui';
import { Sheet } from './Sheet';

/** Renders the promise-based confirm() / prompt() dialogs from the UI store. */
export function Dialogs() {
  const confirm = useUi((s) => s.confirm);
  const prompt = useUi((s) => s.prompt);
  const t = useT();

  if (confirm) {
    return (
      <Sheet className="dialog" label={confirm.message} onClose={() => confirm.resolve(false)}>
        <p style={{ margin: 0 }}>{confirm.message}</p>
        <div className="dialog-actions">
          <button className="btn" onClick={() => confirm.resolve(false)}>
            {t('common.cancel')}
          </button>
          <button
            className={confirm.danger ? 'btn danger' : 'btn primary'}
            onClick={() => confirm.resolve(true)}
            autoFocus
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </Sheet>
    );
  }

  if (prompt) return <PromptDialog key={prompt.title} />;
  return null;
}

function PromptDialog() {
  const prompt = useUi((s) => s.prompt)!;
  const [value, setValue] = useState(prompt.initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Sheet className="dialog" label={prompt.title} onClose={() => prompt.resolve(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) prompt.resolve(value.trim());
        }}
      >
        <h2>{prompt.title}</h2>
        <input
          ref={inputRef}
          className="input"
          value={value}
          maxLength={120}
          placeholder={prompt.placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => prompt.resolve(null)}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            {prompt.confirmLabel}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
