import type { CSSProperties } from 'react';
import type { Toast } from '../lib/hooks';

export function ToastView({ toast, onDone, onHold }: { toast: Toast | null; onDone: () => void; onHold: (held: boolean) => void }) {
  if (!toast) return null;
  return (
    <div
      className="toast"
      role="status"
      onMouseEnter={() => onHold(true)}
      onMouseLeave={() => onHold(false)}
      onFocus={() => onHold(true)}
      onBlur={() => onHold(false)}
    >
      {toast.dot && <span className="toast-dot" aria-hidden="true" style={{ '--dot': toast.dot } as CSSProperties} />}
      <span>{toast.message}</span>
      {toast.action && (
        <button
          className="link"
          onClick={() => {
            toast.action?.run();
            onHold(false);
            onDone();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
