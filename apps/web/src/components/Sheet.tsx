import { useEffect, type ReactNode } from 'react';

interface Props {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label: string;
}

/** Bottom sheet on phones, centred card on larger screens. Closes on backdrop click or Escape. */
export function Sheet({ onClose, children, className = 'sheet', label }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
