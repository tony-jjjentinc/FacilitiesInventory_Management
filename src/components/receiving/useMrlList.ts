import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api';
import { getCachedData, invalidateCache, setCachedData } from '../../services/cache';
import type { MrlListResponse } from '../../types';

export const MRL_CACHE_KEY = 'receiving:mrls';

/** Fetches the MRL list and keeps a saved copy, so a later open shows it at once and refreshes behind it. */
export async function prefetchMrls(): Promise<void> {
  try {
    setCachedData(MRL_CACHE_KEY, await apiRequest<MrlListResponse>('receiving:listMrls'));
  } catch {
    /* the modal will try again and show the error */
  }
}

export function invalidateMrls(): void {
  invalidateCache(MRL_CACHE_KEY);
}

export function useMrlList(active: boolean) {
  const [data, setData] = useState<MrlListResponse | null>(() => getCachedData<MrlListResponse>(MRL_CACHE_KEY));
  const [loadingAll, setLoadingAll] = useState(false); // nothing saved yet: fetching the whole list
  const [refreshing, setRefreshing] = useState(false); // a saved copy is showing while the new one loads
  const [error, setError] = useState('');
  const run = useRef(0);

  const load = useCallback(async () => {
    const id = ++run.current;
    const saved = getCachedData<MrlListResponse>(MRL_CACHE_KEY);
    if (saved) { setData(saved); setRefreshing(true); } else { setLoadingAll(true); }
    setError('');
    try {
      const fresh = await apiRequest<MrlListResponse>('receiving:listMrls');
      if (id !== run.current) return;
      setCachedData(MRL_CACHE_KEY, fresh);
      setData(fresh);
    } catch (err: any) {
      if (id !== run.current) return;
      setError(saved ? `Could not refresh the list (${err.message || 'error'}). Showing the saved copy.` : (err.message || 'Failed to load the MRL list.'));
    } finally {
      if (id === run.current) { setLoadingAll(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => { if (active) load(); }, [active, load]);

  return { data, loadingAll, refreshing, error, reload: load };
}
