/**
 * @file Field.tsx
 * @description One form field: label, control, hint and error, in one consistent layout.
 *
 * USAGE (the control is the single child; Field adds id, error styling and the blur hook to it)
 *   <Field form={form} name="qty" label="Quantity" required hint="In the item's unit.">
 *     <input type="number" className="form-control form-control-sm" value={qty} onChange={...} />
 *   </Field>
 *
 * - `required` adds a red * to the label (optional fields get no marker; say "(optional)" in the label if useful).
 * - The error message shows under the control once the field was visited, with the red `is-invalid` outline.
 *   While there is an error the hint is replaced by it.
 * - Works with `<input>`, `<textarea>`, and our `Select`.
 */
import React from 'react';
import type { FormState } from './useForm';

interface Props {
  form: FormState;
  /** key used in the `validate` result; also becomes the control's id */
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  /** bootstrap column classes when used inside a `.row`, e.g. "col-md-6" */
  className?: string;
  children: React.ReactElement<any>;
}

export const Field: React.FC<Props> = ({ form, name, label, required, hint, className = '', children }) => {
  const message = form.error(name);
  const describedBy = message ? `${name}-error` : hint ? `${name}-hint` : undefined;
  const control = React.cloneElement(children, {
    id: children.props.id || name,
    className: `${children.props.className || ''}${message ? ' is-invalid' : ''}`.trim(),
    'aria-invalid': message ? true : undefined,
    'aria-required': required || undefined,
    'aria-describedby': describedBy,
    onBlur: (e: React.FocusEvent) => { form.touch(name); children.props.onBlur?.(e); }
  });
  return (
    <div className={className}>
      <label className="form-label small fw-semibold mb-1" htmlFor={children.props.id || name}>
        {label}{required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
      </label>
      {control}
      {message
        ? <div id={`${name}-error`} className="invalid-feedback d-block" role="alert">{message}</div>
        : hint && <div id={`${name}-hint`} className="form-text">{hint}</div>}
    </div>
  );
};
