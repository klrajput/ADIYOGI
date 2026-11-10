import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

let counter = 0;

/**
 * Lightweight toast notifications (no third-party dependency).
 * Toasts are announced politely for assistive technology and auto-dismiss.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, { tone = 'info', duration = 4500 } = {}) => {
      counter += 1;
      const id = counter;
      setToasts((current) => [...current.slice(-3), { id, message, tone }]);
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, tone: 'success' }),
      error: (message, options) => push(message, { ...options, tone: 'crisis' }),
      info: (message, options) => push(message, { ...options, tone: 'info' }),
      dismiss,
    }),
    [push, dismiss]
  );

  const toneClass = {
    info: 'border-support-200 bg-support-50 text-support-600',
    success: 'border-primary-200 bg-primary-50 text-primary-800',
    crisis: 'border-crisis-200 bg-crisis-50 text-crisis-600',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto w-full max-w-md animate-in rounded-lg border px-4 py-3 text-sm shadow-lift ${
              toneClass[toast.tone] || toneClass.info
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="leading-relaxed">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="text-xs font-semibold opacity-70 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

export default ToastContext;
