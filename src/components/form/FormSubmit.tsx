/**
 * @file FormSubmit.tsx
 * @description The submit button row of a form. The button is greyed out until the form is valid, and a
 * "what is missing" note beside it says exactly why, so the user is never left guessing.
 *
 *   <FormSubmit form={form} label="Save item" loadingLabel="Saving..." busy={saving}
 *     onSubmit={save} onCancel={close} />
 *
 * - `form` supplies the list of problems; the first 3 are shown, then "and N more".
 * - While `busy` the button shows the Loading component and both buttons are disabled.
 * - Use `variant` for non-primary actions (e.g. "danger" for a destructive submit).
 * - Pass `type="submit"` when the buttons live inside a <form> and you want Enter to submit.
 */
import React from 'react';
import { Loading } from '../Loading';
import type { FormState } from './useForm';

interface Props {
  form: FormState;
  label: string;
  loadingLabel?: string;
  busy?: boolean;
  variant?: 'primary' | 'danger' | 'success';
  type?: 'button' | 'submit';
  onSubmit?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

const SHOWN = 3;

export const FormSubmit: React.FC<Props> = ({ form, label, loadingLabel = 'Saving...', busy = false, variant = 'primary', type = 'button', onSubmit, onCancel, cancelLabel = 'Cancel' }) => {
  const reasons = Object.values(form.errors);
  const blocked = reasons.length > 0;
  const note = blocked ? `To continue: ${reasons.slice(0, SHOWN).join(' ')}${reasons.length > SHOWN ? ` (and ${reasons.length - SHOWN} more)` : ''}` : '';
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
      {blocked && !busy && <div className="small text-muted me-auto" role="status"><i className="bi bi-info-circle me-1" aria-hidden="true"></i>{note}</div>}
      {onCancel && <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>{cancelLabel}</button>}
      {/* a disabled button shows no tooltip of its own, so the reason also sits on the wrapper */}
      <span title={blocked ? note : undefined}>
        <button type={type} className={`btn btn-${variant} btn-sm`} onClick={type === 'button' ? onSubmit : undefined} disabled={blocked || busy}>
          {busy ? <Loading variant="button" label={loadingLabel} /> : label}
        </button>
      </span>
    </div>
  );
};
