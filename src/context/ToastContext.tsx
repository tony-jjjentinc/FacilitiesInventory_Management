/**
 * @file ToastContext.tsx
 * @description App-wide toast notifications. `ToastProvider` (mounted once in main.tsx) renders the
 * stack; any component shows a toast through the `useToast()` hook.
 *
 * USAGE
 *   const toast = useToast();
 *   toast.success('Receipt RCP-2026-0001 submitted.');
 *   toast.error('Select the goods receiver before submitting.');
 *   toast.warning('3 items have no price and are received at ₱0.');
 *   toast.info('The catalog was refreshed in the background.');
 *
 * VARIANTS (the title and icon are fixed per variant; only the message is yours)
 *   success  green  "Done"                          lives 5 s
 *   info     blue   "Notice"                        lives 5 s
 *   warning  amber  "Please note"                   lives 7 s
 *   error    red    "Something needs your attention" lives 9 s (longer, so it can be read)
 *
 * ACTION BUTTONS (optional second argument)
 *   toast.success('Item saved.', { actions: [
 *     { label: 'Undo', onClick: () => undoSave() },
 *     { label: 'View', onClick: () => navigate('/inventory') }
 *   ] });
 *   Clicking an action closes the toast, then runs its `onClick`. A toast with actions still
 *   disappears on its normal timer.
 *
 * BEHAVIOUR
 *   - Position: bottom center, on every screen size.
 *   - At most 4 toasts are shown; a 5th pushes out the oldest.
 *   - The same message is not stacked twice while it is still on screen.
 *   - Each toast has a close button and dismisses itself after its lifetime.
 *   - Errors are announced to screen readers as alerts, the others as status messages.
 *   - Messages are plain text. Keep them to one or two short sentences, written for the user.
 *   - `useToast()` throws when used outside `ToastProvider`.
 *
 * STYLE: `.toast-stack` and `.app-toast*` in index.css (square corners, coloured left border).
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/** The four toast variants. */
type ToastKind = 'error' | 'success' | 'warning' | 'info';
/** A button shown under the message: `label` is its text, `onClick` runs after the toast closes. */
export interface ToastAction { label: string; onClick: () => void }
/** Optional second argument of every toast method. */
interface ToastOptions { actions?: ToastAction[] }
interface ToastItem { id: number; kind: ToastKind; message: string; actions?: ToastAction[] }

/** What `useToast()` returns: one method per variant, each `(message, options?) => void`. */
interface ToastApi {
  error: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TITLE: Record<ToastKind, string> = { error: 'Something needs your attention', success: 'Done', warning: 'Please note', info: 'Notice' };
const ICON: Record<ToastKind, string> = { error: 'bi-exclamation-octagon-fill', success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
// errors stay longer so they can be read
const LIFETIME: Record<ToastKind, number> = { error: 9000, warning: 7000, success: 5000, info: 5000 };

/** Mount once near the app root. Holds the toast list and renders the stack. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const live = useRef(new Map<string, number>()); // message -> id of the toast showing it

  const dismiss = useCallback((id: number) => {
    live.current.forEach((v, k) => { if (v === id) live.current.delete(k); });
    setItems(list => list.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string, options?: ToastOptions) => {
    if (live.current.has(message)) return; // the same message is already on screen
    const id = nextId.current++;
    live.current.set(message, id);
    setItems(list => [...list.slice(-3), { id, kind, message, actions: options?.actions }]); // at most 4 at once
    window.setTimeout(() => dismiss(id), LIFETIME[kind]);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    error: (m, o) => push('error', m, o),
    success: (m, o) => push('success', m, o),
    warning: (m, o) => push('warning', m, o),
    info: (m, o) => push('info', m, o)
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
              {t.actions && t.actions.length > 0 && (
                <div className="d-flex gap-2 mt-2">
                  {t.actions.map(a => (
                    <button key={a.label} type="button" className="btn btn-primary btn-sm py-0" onClick={() => { dismiss(t.id); a.onClick(); }}>{a.label}</button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={() => dismiss(t.id)}></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/** Access the toast methods from any component under `ToastProvider`. See the file header for usage. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
