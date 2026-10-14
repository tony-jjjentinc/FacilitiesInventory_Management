import React from 'react';
import type { useDraft } from './useDraft';
import { toTimestamp } from '../../utils/datetime';

type Draft = ReturnType<typeof useDraft>;

const left = (iso: string) => {
  const h = (toTimestamp(iso) - Date.now()) / 3600000;
  return h >= 1 ? `${Math.floor(h)} h` : `${Math.max(1, Math.round(h * 60))} min`;
};

/** Shown at the top of a form only while a saved draft waits for a decision. */
export const DraftResume: React.FC<{ draft: Draft; what: string; /** the form is still getting ready, so the search for a draft has not run yet */ waiting?: boolean }> = ({ draft, what, waiting }) => {
  const { existing } = draft;
  if (!existing) return waiting && !draft.looked ? <div className="small text-muted mb-2" role="status">Looking for a saved draft…</div> : null;
  return (
    <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 small" role="status">
      <span>You have a saved draft for {what} (expires in {left(existing.expiresAt)}). Resuming replaces what is on the form now.</span>
      <span className="d-flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={draft.resume}>Resume draft</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={draft.discard}>Discard it</button>
      </span>
    </div>
  );
};

/** Draft status with Save draft and Discard draft: sits on the same row as the form's own buttons. */
export const DraftActions: React.FC<{ draft: Draft }> = ({ draft }) => {
  const { existing, status, error } = draft;
  if (existing) return null; // the resume banner comes first
  const text = status === 'saving' ? 'Saving draft…'
    : status === 'saved' && draft.draft ? `Draft saved · expires in ${left(draft.draft.expiresAt)}`
    : status === 'error' ? `Not saved: ${error}`
    : status === 'conflict' ? error
    : 'Autosaves as a draft';
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 small text-muted me-auto" role="status" aria-live="polite">
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => draft.save(status === 'conflict')} disabled={status === 'saving'}>
        {status === 'conflict' ? 'Overwrite' : 'Save draft'}
      </button>
      {draft.draft && <button type="button" className="btn btn-link btn-sm p-0" onClick={draft.discard}>Discard draft</button>}
      <span className={status === 'error' || status === 'conflict' ? 'text-danger' : ''}>{text}</span>
    </div>
  );
};
