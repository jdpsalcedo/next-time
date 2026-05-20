import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 0;
const DEFAULT_DURATION_MS = 2800;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback((message, opts = {}) => {
    const id = ++nextId;
    const variant = opts.variant || 'success';
    const duration = opts.duration ?? DEFAULT_DURATION_MS;
    setToasts((prev) => [...prev, { id, message, variant }]);
    if (duration > 0) {
      const handle = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, handle);
    }
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    for (const handle of timers.current.values()) clearTimeout(handle);
    timers.current.clear();
  }, []);

  const value = {
    show,
    dismiss,
    success: (msg, opts) => show(msg, { ...opts, variant: 'success' }),
    error: (msg, opts) => show(msg, { ...opts, variant: 'error', duration: opts?.duration ?? 5000 }),
    info: (msg, opts) => show(msg, { ...opts, variant: 'info' }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toast toast-${t.variant}`}
            onClick={() => dismiss(t.id)}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
