/**
 * @file useEntity.ts
 * @description Loads one entity action (`entity:getProfile`, `entity:getStock`, ...) with the stale-while-revalidate cache.
 *
 *   const { data, loading, error, reload } = useEntityData<EntityStock>('getStock', 'AREA', 'ST-A');
 *
 * - Cached data shows immediately; fresh data replaces it. `loading` is true only while nothing is shown yet.
 * - `reload()` drops the cached copy and fetches again (wire it to a refresh button).
 * - Cache keys start with `entity:`, so `invalidateCache('entity:')` after a change refreshes every entity page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr, invalidateCache } from '../../services/cache';
import type { EntityScopeType } from '../../types';

export function useEntityData<T>(action: string, scopeType: EntityScopeType, scopeRef: string, extra: Record<string, unknown> = {}, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const extraKey = JSON.stringify(extra);
  const key = `entity:${action}:${scopeType}:${scopeRef}:${extraKey}`;
  const seq = useRef(0);

  const load = useCallback(() => {
    const mine = ++seq.current;
    const stillMine = () => mine === seq.current;
    setError('');
    return fetchWithSwr<T>(key, () => apiRequest<T>(`entity:${action}`, { scopeType, scopeRef, ...extra }), (d, cached) => {
      if (!stillMine()) return;
      setData(d);
      if (cached) setLoading(false);
    })
      .catch(err => { if (stillMine()) setError(err.message || 'Failed to load.'); })
      .finally(() => { if (stillMine()) { setLoading(false); setRefreshing(false); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    setData(null);
    setLoading(true);
    load();
  }, [enabled, load]);

  const reload = useCallback(() => { invalidateCache(key); setRefreshing(true); return load(); }, [key, load]);
  return { data, loading, refreshing, error, reload };
}

/** Friendly text for the two error cases every entity page can hit. */
export function entityErrorText(error: string, what: string): { title: string; text: string } {
  if (/NOT_FOUND/i.test(error)) return { title: 'Not found', text: `We could not find this ${what}. It may have been renamed or removed.` };
  if (/UNAUTHORIZED|FORBIDDEN/i.test(error)) return { title: 'No access', text: `You do not have access to this ${what}.` };
  return { title: 'Could not load', text: error };
}
