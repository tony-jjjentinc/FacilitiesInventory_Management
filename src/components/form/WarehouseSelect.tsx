import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import { Select } from '../Select';
import type { StorageOptions } from '../../types';

/**
 * Warehouse picker (names, from receiving:getStorageOptions). A value that is not one of the real warehouses, such as the old
 * placeholder code, is replaced by the first warehouse as soon as the list is known, so a form never posts a place that does not exist.
 */
export const WarehouseSelect: React.FC<{ value: string; onChange: (code: string) => void; className?: string }> = ({ value, onChange, className = 'form-select form-select-sm' }) => {
  const [warehouses, setWarehouses] = useState<StorageOptions['warehouses']>([]);
  useEffect(() => {
    fetchWithSwr<StorageOptions>('receiving:storageOptions', () => apiRequest<StorageOptions>('receiving:getStorageOptions'), o => { if (o) setWarehouses(o.warehouses || []); }, { persist: true }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (warehouses.length > 0 && !warehouses.some(w => w.id === value)) onChange(warehouses[0].id);
  }, [warehouses, value, onChange]);
  return (
    <Select className={className} value={warehouses.some(w => w.id === value) ? value : ''} onChange={e => onChange(e.target.value)}>
      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
    </Select>
  );
};
