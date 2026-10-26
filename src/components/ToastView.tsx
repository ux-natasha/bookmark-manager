import type { CSSProperties } from 'react';
import type { Toast } from '../lib/hooks';

export function ToastView({ toast, onDone }: { toast: Toast | null; onDone: () => void }) {
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      {toast.dot && <span className="toast-dot" aria-hidden="true" style={{ '--dot': toast.dot } as CSSProperties} />}
      <span>{toast.message}</span>
      {toast.action && (
        <button
          className="link"
          onClick={() => {
            toast.action?.run();
            onDone();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
