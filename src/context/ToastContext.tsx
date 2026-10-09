import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastKind = 'error' | 'success' | 'warning' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastApi {
  error: (message: string) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TITLE: Record<ToastKind, string> = { error: 'Something needs your attention', success: 'Done', warning: 'Please note', info: 'Notice' };
const ICON: Record<ToastKind, string> = { error: 'bi-exclamation-octagon-fill', success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
// errors stay longer so they can be read
const LIFETIME: Record<ToastKind, number> = { error: 9000, warning: 7000, success: 5000, info: 5000 };

/** App-wide toast messages: top right under the navbar (top centered on phones). Use `useToast()` anywhere. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems(list => list.filter(t => t.id !== id)), []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems(list => [...list.slice(-3), { id, kind, message }]); // at most 4 at once
    window.setTimeout(() => dismiss(id), LIFETIME[kind]);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    error: m => push('error', m),
    success: m => push('success', m),
    warning: m => push('warning', m),
    info: m => push('info', m)
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="assertive" aria-atomic="false">
        {items.map(t => (
          <div key={t.id} className={`app-toast app-toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <i className={`bi ${ICON[t.kind]} app-toast-icon`}></i>
            <div className="flex-grow-1">
              <div className="app-toast-title">{TITLE[t.kind]}</div>
              <div className="app-toast-message">{t.message}</div>
            </div>
            <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={() => dismiss(t.id)}></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
