import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import { useT } from '../i18n';
import '../collection.css';

interface Option<T extends string> {
  value: T;
  label: string;
  short: string;
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
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="sort-menu" ref={root}>
      <button
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
        <div className="sort-list" role="menu" aria-label={label}>
          {options.map((o) => (
            <button
              key={o.value}
              role="menuitemradio"
              aria-checked={o.value === value}
              className="sort-item"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="grow">{o.label}</span>
              {o.value === value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
