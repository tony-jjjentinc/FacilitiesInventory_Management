/**
 * @file cache.ts
 * @description Centralized client-side caching and Stale-While-Revalidate (SWR) hydration service.
 * Enables instantaneous page rendering (0ms delay) from cache while re-verifying fresh data in the background.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_PREFIX = 'jjjei_swr_';

/**
 * Retrieves cached data from memory or sessionStorage.
 */
export function getCachedData<T>(key: string): T | null {
  // 1. Fast in-memory lookup
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!.data as T;
  }

  // 2. Fallback to sessionStorage
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (raw) {
      const entry: CacheEntry<T> = JSON.parse(raw);
      memoryCache.set(key, entry);
      return entry.data;
    }
  } catch (err) {
    console.warn(`[Cache] Error reading key '${key}' from sessionStorage:`, err);
  }

  return null;
}

/**
 * Stores data into memory and sessionStorage.
 */
export function setCachedData<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now()
  };

  memoryCache.set(key, entry);

  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (err) {
    console.warn(`[Cache] Error writing key '${key}' to sessionStorage:`, err);
  }
}

/**
 * Clears or invalidates cache entries matching a prefix or exact key.
 */
export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
    return;
  }

  for (const k of memoryCache.keys()) {
    if (k.startsWith(keyPrefix)) {
      memoryCache.delete(k);
    }
  }

  const prefixedTarget = `${CACHE_PREFIX}${keyPrefix}`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith(prefixedTarget)) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));
}

/**
 * Stale-While-Revalidate (SWR) Runner:
 * 1. Immediately notifies caller with cached data if available (0ms render).
 * 2. Concurrently dispatches background network fetch to revalidate and update cache.
 */
export async function fetchWithSwr<T>(
  key: string,
  fetcher: () => Promise<T>,
  onUpdate: (data: T, isInitialCache: boolean) => void
): Promise<T> {
  const cached = getCachedData<T>(key);
  let hasServedCached = false;

  if (cached !== null && cached !== undefined) {
    onUpdate(cached, true);
    hasServedCached = true;
  }

  try {
    const freshData = await fetcher();
    setCachedData(key, freshData);
    onUpdate(freshData, false);
    return freshData;
  } catch (err) {
    if (!hasServedCached) {
      throw err;
    }
    console.warn(`[Cache] Background hydration failed for '${key}', serving cached data:`, err);
    return cached as T;
  }
}
