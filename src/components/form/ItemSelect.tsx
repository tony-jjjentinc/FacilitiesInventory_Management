/**
 * @file ItemSelect.tsx
 * @description Pick a catalog item by typing part of its name, SKU or ID (the browser filters the list as you type). The value is the
 * item ID; the chosen item's name shows under the field. Leaving the field with text that names exactly one item picks that item.
 */
import React, { useEffect, useId, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';

interface CatalogItem { ID: string; SKU?: string; Name: string; Brand?: string; Model?: string; UOM?: string; Status?: string }

interface Props {
  value: string;
  onChange: (itemId: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export const ItemSelect: React.FC<Props> = ({ value, onChange, className = 'form-control form-control-sm', placeholder = 'Type an item name, SKU or ID…', required }) => {
  const list = useId();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    fetchWithSwr<CatalogItem[]>('catalog:items', () => apiRequest<CatalogItem[]>('catalog:getItems'), rows => {
      if (Array.isArray(rows)) setItems(rows.filter(r => String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'));
    }, { persist: true }).catch(() => undefined);
  }, []);
  const typed = value.trim().toLowerCase();
  const match = items.find(i => i.ID.toLowerCase() === typed);
  // the catalog can be large: only start listing once something is typed
  const settle = () => {
    setTouched(true);
    if (!typed || match || items.length === 0) return;
    const one = items.filter(i => `${i.Name} ${i.SKU || ''} ${i.ID}`.toLowerCase().includes(typed));
    if (one.length === 1) onChange(one[0].ID);
  };
  return (
    <>
      <input type="search" autoComplete="off" list={list} required={required} className={`${className}${touched && typed && items.length > 0 && !match ? ' is-invalid' : ''}`} placeholder={placeholder}
        value={value} onChange={e => onChange(e.target.value)} onBlur={settle} />
      <datalist id={list}>{typed.length >= 2 ? items.slice(0, 4000).map(i => <option key={i.ID} value={i.ID}>{`${i.Name}${i.SKU ? ` · ${i.SKU}` : ''}`}</option>) : null}</datalist>
      {match && <div className="form-text">{match.Name}{match.UOM ? ` (${match.UOM})` : ''}</div>}
      {touched && typed && items.length > 0 && !match && <div className="invalid-feedback d-block">Pick an item from the list.</div>}
    </>
  );
};
