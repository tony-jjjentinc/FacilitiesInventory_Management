/**
 * @file RefSelect.tsx
 * @description The right picker for the place or person a ledger line starts from or goes to: a warehouse, an activity or a custodian
 * (by the line's source or destination type). Any other type (an MRL, a receipt) is a typed reference.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import { Select } from '../Select';
import { WarehouseSelect } from './WarehouseSelect';
import { PersonSelect } from './PersonSelect';
import type { DirectoryAccount, OpenActivity } from '../../types';

const OPEN = ['PLANNED', 'ACTIVE', 'ON_HOLD'];

interface Props { type: string; value: string; onChange: (ref: string) => void; className?: string }

/** The accounts a tool can be handed to (the directory), as options for PersonSelect. */
export function usePeopleOptions() {
  const [directory, setDirectory] = useState<DirectoryAccount[]>([]);
  useEffect(() => {
    let alive = true;
    fetchWithSwr<DirectoryAccount[]>('accounts:directory', () => apiRequest<DirectoryAccount[]>('accounts:getDirectory'), d => { if (alive && Array.isArray(d)) setDirectory(d); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return useMemo(() => directory.map(a => ({ email: a.email, label: `${a.name || a.email} (${a.email})` })), [directory]);
}

export const RefSelect: React.FC<Props> = ({ type, value, onChange, className = 'form-control form-control-sm' }) => {
  const people = usePeopleOptions();
  const [activities, setActivities] = useState<OpenActivity[]>([]);
  useEffect(() => {
    if (type !== 'ACTIVITY') return;
    let alive = true;
    fetchWithSwr<OpenActivity[]>('activity:getAll', () => apiRequest<OpenActivity[]>('activity:getAll'), rows => {
      if (alive && Array.isArray(rows)) setActivities(rows.filter(a => OPEN.includes(String(a.Status).toUpperCase())));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [type]);
  if (type === 'INVENTORY' || type === 'WAREHOUSE') return <WarehouseSelect value={value} onChange={onChange} />;
  if (type === 'ACTIVITY') {
    return (
      <Select className="form-select form-select-sm" value={value} onChange={e => onChange(e.target.value)}>
        {activities.map(a => <option key={a.Activity_ID} value={a.Activity_ID}>{a.Activity_ID} · {a.Activity_Name}</option>)}
      </Select>
    );
  }
  if (type === 'IN_HOUSE') return <PersonSelect value={value} onChange={onChange} options={people} />;
  return <input type="text" className={className} value={value} onChange={e => onChange(e.target.value)} required />;
};
