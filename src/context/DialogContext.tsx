/**
 * @file DialogContext.tsx
 * @description In-app replacements for the browser's `confirm`, `prompt` and `alert` boxes. `DialogProvider` (mounted once in
 * main.tsx) renders one modal at a time; any component asks through `useDialog()`. Every call returns a promise, so the call
 * site reads like the native version:
 *
 *   const dialog = useDialog();
 *   if (!await dialog.confirm({ title: 'Commit transaction', message: 'This changes the warehouse stock.', confirmText: 'Commit' })) return;
 *   const reason = await dialog.prompt({ title: 'Cancel transaction', label: 'Why is it cancelled?' });   // string, or null when dismissed
 *   await dialog.alert({ title: 'Rollover blocked', message: issues.join('\n') });
 *
 * - confirm  -> true / false.   prompt -> the trimmed text, or null (dismissed).   alert -> resolves when OK is pressed.
 * - `prompt` requires text by default (`required: false` allows empty); Enter confirms, Esc dismisses; `multiline` for longer text.
 * - Short results (saved, failed, "enter a name") belong in a toast (`useToast`), not here: use these only when the person must decide or read.
 * - Never use `window.confirm / prompt / alert`: they block the page, cannot be styled or tested, and freeze browser automation.
 *   The lint rule `no-alert` enforces it.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface Base { title?: string; confirmText?: string; danger?: boolean }
export interface ConfirmOptions extends Base { message: React.ReactNode; cancelText?: string }
export interface AlertOptions extends Base {
  message: React.ReactNode;
  /** pages to open from the dialog (the dialog closes when one is followed) */
  links?: { label: string; to: string }[];
}
export interface PromptOptions extends Base {
  label: string;
  message?: React.ReactNode;
  defaultValue?: string;
  placeholder?: string;
  /** default true: the answer cannot be empty */
  required?: boolean;
  multiline?: boolean;
  cancelText?: string;
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  alert: (o: AlertOptions) => Promise<void>;
}

type Pending =
  | { kind: 'confirm'; o: ConfirmOptions; done: (v: boolean) => void }
  | { kind: 'prompt'; o: PromptOptions; done: (v: string | null) => void }
  | { kind: 'alert'; o: AlertOptions; done: () => void };

const DialogContext = createContext<DialogApi | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Pending[]>([]);
  const push = useCallback(<T,>(make: (done: (v: T) => void) => Pending) => new Promise<T>(resolve => {
    setQueue(q => [...q, make(v => { setQueue(cur => cur.slice(1)); resolve(v); })]);
  }), []);

  const api = useMemo<DialogApi>(() => ({
    confirm: o => push<boolean>(done => ({ kind: 'confirm', o, done })),
    prompt: o => push<string | null>(done => ({ kind: 'prompt', o, done })),
    alert: o => push<void>(done => ({ kind: 'alert', o, done: () => done(undefined) }))
  }), [push]);

  const current = queue[0];
  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && <DialogView key={queue.length + current.kind} pending={current} />}
    </DialogContext.Provider>
  );
};

const DialogView: React.FC<{ pending: Pending }> = ({ pending }) => {
  const [text, setText] = useState(pending.kind === 'prompt' ? pending.o.defaultValue || '' : '');
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const o = pending.o;
  const required = pending.kind === 'prompt' && pending.o.required !== false;
  const valid = !required || text.trim().length > 0;

  const dismiss = useCallback(() => {
    if (pending.kind === 'confirm') pending.done(false);
    else if (pending.kind === 'prompt') pending.done(null);
    else pending.done();
  }, [pending]);
  const accept = () => {
    if (pending.kind === 'confirm') pending.done(true);
    else if (pending.kind === 'prompt') { if (valid) pending.done(text.trim()); }
    else pending.done();
  };

  useEffect(() => {
    document.body.classList.add('modal-open');
    field.current?.focus();
    field.current?.select();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [dismiss]);

  const title = o.title || (pending.kind === 'prompt' ? pending.o.label : pending.kind === 'alert' ? 'Please note' : 'Are you sure?');
  const confirmText = o.confirmText || (pending.kind === 'alert' ? 'OK' : pending.kind === 'prompt' ? 'Save' : 'Confirm');
  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 2000 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '460px' }}>
        <div className="modal-content border shadow-sm" style={{ borderRadius: '8px' }}>
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <h6 className="modal-title fw-bold text-dark mb-0">{title}</h6>
            {pending.kind !== 'alert' && <button type="button" className="btn-close" aria-label="Close" onClick={dismiss}></button>}
          </div>
          <div className="modal-body p-4">
            {'message' in o && o.message && <div className="text-secondary small mb-2" style={{ whiteSpace: 'pre-line' }}>{o.message}</div>}
            {pending.kind === 'alert' && pending.o.links && pending.o.links.length > 0 && (
              <div className="d-flex flex-wrap gap-3 small mt-2">{pending.o.links.map(l => <a key={l.to} href={`#${l.to}`} onClick={accept}>{l.label}</a>)}</div>
            )}
            {pending.kind === 'prompt' && (
              <>
                <label className="form-label small fw-semibold" htmlFor="dialog-text">{pending.o.label}{required ? ' *' : ''}</label>
                {pending.o.multiline
                  ? <textarea id="dialog-text" ref={field as React.RefObject<HTMLTextAreaElement>} className="form-control form-control-sm" rows={3} placeholder={pending.o.placeholder} value={text} onChange={e => setText(e.target.value)} />
                  : <input id="dialog-text" ref={field as React.RefObject<HTMLInputElement>} className="form-control form-control-sm" placeholder={pending.o.placeholder} value={text} onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); accept(); } }} />}
              </>
            )}
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top d-flex justify-content-end gap-2">
            {pending.kind !== 'alert' && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={dismiss}>{pending.kind === 'confirm' ? pending.o.cancelText || 'Cancel' : pending.o.cancelText || 'Cancel'}</button>}
            <button type="button" className={`btn btn-sm ${o.danger ? 'btn-danger' : 'btn-primary'}`} disabled={!valid} onClick={accept}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}
