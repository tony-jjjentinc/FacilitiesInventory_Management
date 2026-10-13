/**
 * @file useDraft.ts
 * @description Saved progress for a transaction form, kept on the server (api/DraftService.gs): one draft per person,
 * form and identifier, private to its owner, gone 24 hours after the last save.
 *
 * The form passes its state (memoised) and what to do to restore a saved one. The hook:
 *  - looks for an existing draft whenever the identifier changes and offers it (`existing`), without touching the form;
 *  - autosaves a few seconds after the state changes from where it started, but never while an existing draft is undecided;
 *  - saves on demand (`save`), resumes (`resume`), discards (`discard`) and forgets (`clear`, after a successful submit:
 *    the server closes the draft itself when the submit carries `draftId`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../services/api';

export type DraftForm = 'MRL_RECEIVE' | 'MANUAL_RECEIVE' | 'STAGED_TX';
export interface DraftSummary { draftId: string; formType: DraftForm; identifier: string; updatedAt: string; expiresAt: string }
export type DraftStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

const AUTOSAVE_MS = 3000;

export interface UseDraftOptions<T> {
  formType: DraftForm;
  /** What this draft is about (an MRL number). '' = the one unnamed draft of the form. */
  identifier: string;
  /** false while there is nothing to save yet (no MRL loaded, ...) */
  enabled: boolean;
  /** The form's state: pass a memoised object, so it only changes when the form does. */
  state: T;
  /** Puts a saved state back into the form. */
  restore: (saved: T) => void;
}

export function useDraft<T extends object>({ formType, identifier, enabled, state, restore }: UseDraftOptions<T>) {
  const [existing, setExisting] = useState<DraftSummary | null>(null);
  const [draft, setDraft] = useState<DraftSummary | null>(null); // the draft this form is tied to
  const [status, setStatus] = useState<DraftStatus>('idle');
  const [error, setError] = useState('');
  const [looked, setLooked] = useState(false); // the search for a saved draft of this identifier has finished
  const json = useMemo(() => JSON.stringify(state), [state]);
  const baseline = useRef<string | null>(null); // the state when this identifier started: only changes from it are worth saving
  const lastSaved = useRef<string | null>(null);
  const version = useRef<string | undefined>(undefined); // updatedAt of the draft as this form last saw it

  // a new identifier is a new draft: forget the old one and look for a saved one
  useEffect(() => {
    baseline.current = null; lastSaved.current = null; version.current = undefined;
    setDraft(null); setExisting(null); setStatus('idle'); setError(''); setLooked(false);
    if (!enabled) return;
    let alive = true;
    apiRequest<DraftSummary[]>('draft:list', { formType, identifier })
      .then(rows => { if (alive && Array.isArray(rows) && rows[0]) setExisting(rows[0]); })
      .catch(() => undefined) // drafts are a convenience: the form works without them
      .finally(() => { if (alive) setLooked(true); });
    return () => { alive = false; };
  }, [formType, identifier, enabled]);

  const persist = useCallback(async (force = false) => {
    setStatus('saving'); setError('');
    try {
      const saved = await apiRequest<DraftSummary>('draft:save', {
        formType, identifier, payload: JSON.parse(json), ...(force || !version.current ? {} : { expectedUpdatedAt: version.current })
      });
      setDraft(saved); version.current = saved.updatedAt; lastSaved.current = json; setStatus('saved');
      return true;
    } catch (err: any) {
      const msg = String(err?.message || '');
      setStatus(/saved somewhere else/.test(msg) ? 'conflict' : 'error');
      setError(msg.replace(/^[A-Z_:]+:\s*/, '') || 'Could not save the draft.');
      return false;
    }
  }, [formType, identifier, json]);

  // autosave: only once the form has moved on from where it started, and not while a saved draft awaits a decision
  useEffect(() => {
    if (!enabled) return;
    if (baseline.current === null) { baseline.current = json; return; }
    if (existing || json === baseline.current || json === lastSaved.current || status === 'conflict') return;
    const t = window.setTimeout(() => { persist(); }, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [enabled, json, existing, status, persist]);

  const resume = useCallback(async () => {
    if (!existing) return;
    try {
      const d = await apiRequest<DraftSummary & { payload: T }>('draft:get', { draftId: existing.draftId });
      restore(d.payload);
      setDraft(d); version.current = d.updatedAt; setExisting(null); setStatus('saved');
      lastSaved.current = null; // the restored state is saved again by the next change
      baseline.current = null; // and counts as the starting point
    } catch (err: any) {
      setExisting(null); setStatus('error'); setError(String(err?.message || 'The draft is gone.').replace(/^[A-Z_:]+:\s*/, ''));
    }
  }, [existing, restore]);

  const discard = useCallback(async () => {
    const id = (existing || draft)?.draftId;
    setExisting(null); setDraft(null); setStatus('idle'); version.current = undefined; lastSaved.current = null; baseline.current = null;
    if (id) await apiRequest('draft:discard', { draftId: id }).catch(() => undefined);
  }, [existing, draft]);

  /** After a successful submit (the server already closed the draft). */
  const clear = useCallback(() => {
    setExisting(null); setDraft(null); setStatus('idle'); setError(''); version.current = undefined; lastSaved.current = null; baseline.current = null;
  }, []);

  return { existing, looked, draft, draftId: draft?.draftId, status, error, save: persist, resume, discard, clear };
}
