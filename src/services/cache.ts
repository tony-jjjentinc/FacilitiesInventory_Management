/**
 * @file cache.ts
 * @description Centralized client-side caching and Stale-While-Revalidate (SWR) hydration service.
 * Enables instantaneous page rendering (0ms delay) from cache while re-verifying fresh data in the background.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

import { getCurrentUser } from './auth';

const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_PREFIX = 'jjjei_swr_';

/** Persisted (localStorage) entries survive a new tab or login, so a slow API still opens on last-known data. */
const PERSIST_PREFIX = `${CACHE_PREFIX}p|`;
const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The signed-in person; persisted entries are only ever read or written for them. '' = nobody, so no persistence. */
function currentUserId(): string {
  try {
    const u = getCurrentUser();
    return String(u?.id || u?.email || '').trim().toLowerCase();
  } catch { return ''; }
}

const persistKey = (uid: string, key: string) => `${PERSIST_PREFIX}${uid}|${key}`;

function readPersisted<T>(key: string): CacheEntry<T> | null {
  const uid = currentUserId();
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(persistKey(uid, key));
    if (!raw) return null;
    const entry: CacheEntry<T> & { userId?: string } = JSON.parse(raw);
    if (entry.userId !== uid || Date.now() - entry.timestamp > PERSIST_MAX_AGE_MS) return null;
    return entry;
  } catch { return null; }
}

function writePersisted<T>(key: string, entry: CacheEntry<T>): void {
  const uid = currentUserId();
  if (!uid) return;
  try {
    localStorage.setItem(persistKey(uid, key), JSON.stringify({ ...entry, userId: uid }));
  } catch (err) {
    console.warn(`[Cache] Error persisting key '${key}':`, err);
  }
}

/** Removes persisted entries (every user's) whose key starts with `keyPrefix`; no prefix removes them all. */
function purgePersisted(keyPrefix = ''): void {
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PERSIST_PREFIX)) continue;
      const key = k.slice(PERSIST_PREFIX.length).split('|').slice(1).join('|');
      if (key.startsWith(keyPrefix)) remove.push(k);
    }
    remove.forEach(k => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

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
  purgePersisted(keyPrefix);
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

  // entity pages (warehouse, area, ...) are built from stock, ledger, activity and config data: when any of those
  // change, their cached copies are stale too
  if (/^(transaction:history|inventory:stock|custody:list|activity|config:)/.test(keyPrefix)) invalidateCache('entity:');

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
  onUpdate: (data: T, isInitialCache: boolean, updatedAt: number) => void,
  options: { persist?: boolean } = {}
): Promise<T> {
  let cached = getCachedData<T>(key);
  let cachedAt = memoryCache.get(key)?.timestamp ?? Date.now();
  if ((cached === null || cached === undefined) && options.persist) {
    const stored = readPersisted<T>(key);
    if (stored) { cached = stored.data; cachedAt = stored.timestamp; }
  }
  let hasServedCached = false;

  if (cached !== null && cached !== undefined) {
    onUpdate(cached, true, cachedAt);
    hasServedCached = true;
  }

  try {
    const freshData = await fetcher();
    setCachedData(key, freshData);
    if (options.persist) writePersisted(key, { data: freshData, timestamp: Date.now() });
    onUpdate(freshData, false, Date.now());
    return freshData;
  } catch (err) {
    if (!hasServedCached) {
      throw err;
    }
    console.warn(`[Cache] Background hydration failed for '${key}', serving cached data:`, err);
    return cached as T;
  }
}
