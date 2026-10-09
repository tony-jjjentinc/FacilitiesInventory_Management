import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import type { OpenActivity, StorageOptions } from '../../types';

const OPEN = ['PLANNED', 'ACTIVE', 'ON_HOLD'];

/** Warehouses/storage tree and open activities used by the receiving forms. */
export function useReceivingLookups() {
  const [storage, setStorage] = useState<StorageOptions>({ warehouses: [], storage: [] });
  const [activities, setActivities] = useState<OpenActivity[]>([]);
  const [error, setError] = useState('');

  const loadActivities = useCallback(async () => {
    const rows = await apiRequest<OpenActivity[]>('activity:getAll', { status: 'ALL' });
    setActivities((Array.isArray(rows) ? rows : []).filter(a => OPEN.includes(String(a.Status).toUpperCase())));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [opts] = await Promise.all([apiRequest<StorageOptions>('receiving:getStorageOptions'), loadActivities()]);
        if (!cancelled) setStorage(opts);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load warehouses and activities.');
      }
    })();
    return () => { cancelled = true; };
  }, [loadActivities]);

  return { storage, activities, reloadActivities: loadActivities, error };
}
