/**
 * @file recent.ts
 * @description The dashboard's "Recent actions": the last few things a person opened from the dashboard (quick action buttons,
 * draft entries, key figures). Kept in this browser per user, so it shows at once and needs no server call.
 * `to` is where it goes (a route, or a name the dashboard knows); without it the dashboard finds the quick action by its label.
 */
export interface RecentEntry { label: string; at: number; to?: string }

const KEEP = 8;
const keyFor = (userId: string) => `jjjei_recent_actions|${userId}`;

export function readRecent(userId: string): RecentEntry[] {
  try { const v = JSON.parse(localStorage.getItem(keyFor(userId)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** Puts an entry first (replacing an older one with the same label) and returns the new list. */
export function pushRecent(userId: string, entry: { label: string; to?: string }): RecentEntry[] {
  const next = [{ ...entry, at: Date.now() }, ...readRecent(userId).filter(r => r.label !== entry.label)].slice(0, KEEP);
  try { localStorage.setItem(keyFor(userId), JSON.stringify(next)); } catch { /* private mode: it just is not remembered */ }
  return next;
}
