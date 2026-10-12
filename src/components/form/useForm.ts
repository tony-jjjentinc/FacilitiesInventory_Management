/**
 * @file useForm.ts
 * @description Validation state for a form. Part of the shared form kit (FormSection, Field, FormSubmit).
 *
 * HOW IT WORKS
 *   1. Write a pure `validate(values)` that returns ALL problems as `{ fieldName: 'message' }` (empty = valid).
 *      Keep it outside the component (or in a *Utils.ts file) so it is stable and easy to test.
 *   2. `const form = useForm(values, validate)`.
 *   3. Wrap each input in `<Field form={form} name="..." label="...">`. A message appears under a field only
 *      after the user has left it (blur), so an untouched form is not covered in red.
 *   4. `<FormSubmit form={form} ...>` keeps the submit button greyed out until the form is valid and always
 *      tells the user what is still missing, so a disabled button is never a mystery.
 *
 * MESSAGE STYLE: "Enter X.", "Choose X.", "X must be ..." - one short sentence per field.
 *
 *   const validate = (v: Values) => {
 *     const e: Record<string, string> = {};
 *     if (!v.name.trim()) e.name = 'Enter the item name.';
 *     if (!(Number(v.qty) > 0)) e.qty = 'Quantity must be above 0.';
 *     return e;
 *   };
 *   const form = useForm(values, validate);
 */
import { useCallback, useMemo, useState } from 'react';

export type FormErrors = Record<string, string>;

export interface FormState {
  /** every current problem, whether or not the field was touched */
  errors: FormErrors;
  valid: boolean;
  /** the message to show under a field: only once the user has left it */
  error: (name: string) => string | undefined;
  /** mark a field as visited (call on blur) */
  touch: (name: string) => void;
  /** show every message now, e.g. after the server rejected the form */
  touchAll: () => void;
  /** forget what was visited, e.g. after a successful submit or reset */
  reset: () => void;
}

export function useForm<V>(values: V, validate: (values: V) => FormErrors): FormState {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const errors = useMemo(() => validate(values), [values, validate]);
  const touch = useCallback((name: string) => setTouched(s => (s.has(name) ? s : new Set(s).add(name))), []);
  const touchAll = useCallback(() => setTouched(new Set(Object.keys(errors))), [errors]);
  const reset = useCallback(() => setTouched(new Set()), []);
  const error = useCallback((name: string) => (touched.has(name) ? errors[name] : undefined), [touched, errors]);
  return { errors, valid: Object.keys(errors).length === 0, error, touch, touchAll, reset };
}
