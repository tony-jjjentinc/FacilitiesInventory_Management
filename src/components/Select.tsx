import React from 'react';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** the field may be left empty: a selectable "None" option (value "") is the empty choice */
  optional?: boolean;
  /** label of the empty choice of an optional field */
  noneLabel?: string;
  /** shown while a required field has no value; it is hidden from the list and cannot be chosen */
  placeholder?: string;
};

/**
 * Form dropdown with one rule set for every field:
 * - required, no value yet  -> "Select a value..." is shown, disabled and hidden from the list
 * - optional                -> a selectable "None" option stands for "nothing chosen"
 * - required with a default -> give it a value (auto-select); the placeholder never appears
 * Filter dropdowns ("All ...") are not form fields and keep using a plain <select>.
 */
export const Select: React.FC<Props> = ({ optional, noneLabel = 'None', placeholder = 'Select a value...', children, value, required, ...rest }) => (
  <select {...rest} value={value} required={required ?? !optional}>
    {optional
      ? <option value="">{noneLabel}</option>
      : (value === '' || value === undefined) && <option value="" disabled hidden>{placeholder}</option>}
    {children}
  </select>
);
