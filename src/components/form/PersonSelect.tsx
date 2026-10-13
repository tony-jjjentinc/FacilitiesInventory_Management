/**
 * @file PersonSelect.tsx
 * @description Pick a person by typing part of their name or email (the browser filters the list as you type), instead of
 * scrolling a long dropdown. The value is the person's email; the chosen person's name shows under the field.
 */
import React, { useId } from 'react';

export interface PersonOption { email: string; label: string }

interface Props {
  id?: string;
  value: string;
  onChange: (email: string) => void;
  options: PersonOption[];
  placeholder?: string;
  className?: string;
}

export const PersonSelect: React.FC<Props> = ({ id, value, onChange, options, placeholder = 'Type a name or email…', className = 'form-control form-control-sm' }) => {
  const list = useId();
  const typed = value.trim().toLowerCase();
  const match = options.find(o => o.email.toLowerCase() === typed);
  return (
    <>
      <input id={id} type="search" autoComplete="off" list={list} className={`${className}${typed && !match ? ' is-invalid' : ''}`} placeholder={placeholder}
        value={value} onChange={e => onChange(e.target.value)} />
      <datalist id={list}>{options.map(o => <option key={o.email} value={o.email}>{o.label}</option>)}</datalist>
      {match && <div className="form-text">{match.label}</div>}
      {typed && !match && <div className="invalid-feedback d-block">Pick someone from the list.</div>}
    </>
  );
};
