import { useUi } from '../stores/ui';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'error' : ''}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
