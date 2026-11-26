import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import { useT } from '../i18n';
import { nextMenuIndex } from '../lib/menuKeys';
import '../collection.css';

interface Option<T extends string> {
  value: T;
  label: string;
  short: string;
}

interface ListProps<T extends string> {
  value: T;
  options: Option<T>[];
  label: string;
  onPick: (value: T) => void;
  /** Closes the menu from the keyboard. */
  onDismiss: () => void;
}

/** The open menu: it takes the focus and moves it with the arrow keys. */
function SortList<T extends string>({ value, options, label, onPick, onDismiss }: ListProps<T>) {
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    items.current[active]?.focus();
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = nextMenuIndex(e.key, active, options.length);
    if (next === null) return;
    e.preventDefault();
    if (next === 'close') onDismiss();
    else setActive(next);
  };

  return (
    // Focusable so that a click between options does not leave the keyboard outside the menu.
    <div className="sort-list" role="menu" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            items.current[i] = el;
          }}
          role="menuitemradio"
          aria-checked={o.value === value}
          className="sort-item"
          tabIndex={i === active ? 0 : -1}
          onClick={() => onPick(o.value)}
        >
          <span className="grow">{o.label}</span>
          {o.value === value && <Check size={16} />}
        </button>
      ))}
    </div>
  );
}

export function SortMenu<T extends string>({
  value,
  options,
  label,
  onChange,
}: {
  value: T;
  options: Option<T>[];
  label: string;
  onChange: (value: T) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="sort-menu" ref={root}>
      <button
        ref={trigger}
        className="btn small sort-btn"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('library.sortLabel', { criterion: current?.short ?? label })}
      >
        <ArrowUpDown size={16} />
        <span className="sort-text">{current?.short}</span>
      </button>
      {open && (
        <SortList
          value={value}
          options={options}
          label={label}
          onPick={(picked) => {
            onChange(picked);
            close();
          }}
          onDismiss={close}
        />
      )}
    </div>
  );
}
