/**
 * @file globalSearchSources.ts
 * @description What the general search can find, and how it matches. Pure functions plus one loader,
 * so the overlay component stays about layout and keyboard handling.
 */
import { apiRequest } from '../services/api';
import { fetchWithSwr } from '../services/cache';
import { getAccess } from '../services/access';
import type { OpenActivity, StorageOptions, SubDepartmentListRow, WarehouseListRow } from '../types';
import { entityPath } from './entity/entityPaths';

export type SearchGroup = 'Actions' | 'Pages' | 'Inventory items' | 'Activities' | 'Warehouses' | 'Sub-Departments';

/** Display order of the groups. */
export const GROUP_ORDER: SearchGroup[] = ['Actions', 'Pages', 'Inventory items', 'Activities', 'Warehouses', 'Sub-Departments'];

export interface SearchResult {
  group: SearchGroup;
  id: string;
  title: string;
  subtitle?: string;
  /** hash-router path to open, e.g. `/inventory?tab=catalog` */
  path: string;
  /** extra words that match but are not shown */
  keywords?: string;
}

/** What the signed-in user may see: mirrors the route guards in App.tsx. */
export interface SearchAccess { analytics: boolean; admin: boolean; custodian: boolean }

/**
 * Role flags for the search, mirroring the API tiers in Auth.gs (APP/CUSTODIAN/ADMIN) and the route guards in App.tsx.
 * custodian = a custodian role in the Facilities department (receiving, storage options).
 */
export function searchAccess(user: { roles?: string[]; department?: string[] } | null): SearchAccess {
  const a = getAccess(user);
  return { admin: a.isAdmin, analytics: a.canSeeAnalytics, custodian: a.isCustodian };
}

/** `custodian: true` entries need a custodian role (the API refuses them otherwise). */
const ACTIONS: (SearchResult & { custodian?: boolean })[] = [
  { group: 'Actions', id: 'a-mrl', title: 'Receive items (MRL)', subtitle: 'Receive a released MRL', path: '/deliveries?tab=receive-mrl', keywords: 'receiving delivery goods', custodian: true },
  { group: 'Actions', id: 'a-manual', title: 'Receive items (Manual)', subtitle: 'Petty cash, RF, RFP or manual entry', path: '/deliveries?tab=receive-manual', keywords: 'receiving add stock petty cash', custodian: true },
  { group: 'Actions', id: 'a-pending', title: 'My delivery tasks', subtitle: 'Assignments and receipts waiting for you', path: '/deliveries?tab=tasks', keywords: 'receiving approve', custodian: true },
  { group: 'Actions', id: 'a-catalog', title: 'Register an inventory item', subtitle: 'Open the inventory catalog', path: '/inventory?tab=catalog', keywords: 'new add catalog sku', custodian: true },
  { group: 'Actions', id: 'a-activity', title: 'Work with an activity', subtitle: 'Allocate, consume or return items', path: '/activities', keywords: 'allocation project' }
];

const pages = (a: SearchAccess): SearchResult[] => [
  { group: 'Pages', id: 'p-dash', title: 'Dashboard', path: '/overview' },
  { group: 'Pages', id: 'p-deliveries', title: 'Deliveries · My tasks', path: '/deliveries' },
  { group: 'Pages', id: 'p-warehouses', title: 'Inventory · Warehouses', path: '/inventory?tab=warehouses' },
  { group: 'Pages', id: 'p-subdepts', title: 'Activities · Sub-Departments', path: '/activities?tab=sub-departments' },
  ...(a.analytics ? ['overview:Overview', 'performance:Performance', 'breakdown:Breakdown', 'stock:Cost of Stock', 'projects:Cost per Activity', 'ledger:Ledger'].map(t => {
    const [k, l] = t.split(':'); return { group: 'Pages' as const, id: `p-an-${k}`, title: `Analytics · ${l}`, path: `/analytics?tab=${k}` };
  }) : []),
  ...['warehouse:Warehouse Stock', 'catalog:Inventory Catalog', 'custody:Tool Custody', 'alerts:Reorder Alerts'].map(t => {
    const [k, l] = t.split(':'); return { group: 'Pages' as const, id: `p-inv-${k}`, title: `Inventory · ${l}`, path: `/inventory?tab=${k}` };
  }),
  { group: 'Pages', id: 'p-act-alloc', title: 'Activities · Allocation', path: '/activities?tab=allocation' },
  { group: 'Pages', id: 'p-act-cons', title: 'Activities · Consumption Log', path: '/activities?tab=consumption' },
  ...(a.admin ? [
    { group: 'Pages' as const, id: 'p-admin', title: 'Admin · Approvals', path: '/admin' },
    { group: 'Pages' as const, id: 'p-admin-price', title: 'Admin · Set Price', path: '/admin?tab=price' },
    { group: 'Pages' as const, id: 'p-config', title: 'Configuration', path: '/configuration' }
  ] : [])
];

/** Static entries (actions and pages) for this user. */
export const staticEntries = (a: SearchAccess): SearchResult[] => [
  ...ACTIONS.filter(x => !x.custodian || a.custodian).map(({ custodian: _c, ...r }) => r),
  ...pages(a)
];

interface CatalogRow { ID: string; SKU?: string; Name: string; Brand?: string; Model?: string; Variant?: string; UOM?: string; Status?: string }
export interface SearchData { items: SearchResult[]; activities: SearchResult[]; warehouses: SearchResult[]; areas: SearchResult[]; subDepartments: SearchResult[]; errors: Partial<Record<SearchGroup, string>> }

/**
 * Loads the searchable data. The catalog and activity calls share their cache keys with the pages that already
 * fetch them, so a warm cache makes this instant. Each source fails on its own: one error never blanks the rest.
 */
export async function loadSearchData(access: SearchAccess, onPart: (patch: Partial<SearchData>) => void): Promise<void> {
  const fail = (group: SearchGroup) => (e: any) => onPart({ errors: { [group]: e?.message || 'Could not load.' } });
  await Promise.all([
    fetchWithSwr<CatalogRow[]>('catalog:items', () => apiRequest<CatalogRow[]>('catalog:getItems'), rows => {
      if (!Array.isArray(rows)) return;
      onPart({ items: rows.map(r => ({
        group: 'Inventory items' as const, id: `i-${r.ID}`, title: r.Name,
        path: entityPath('ITEM', r.ID),
        subtitle: [r.ID, r.SKU, [r.Brand, r.Model, r.Variant].filter(Boolean).join(' '), String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? '' : r.Status].filter(Boolean).join(' · ')
      })) });
    }).catch(fail('Inventory items')),
    fetchWithSwr<OpenActivity[]>('activity:getAll', () => apiRequest<OpenActivity[]>('activity:getAll'), rows => {
      if (!Array.isArray(rows)) return;
      onPart({ activities: rows.map(a => ({
        group: 'Activities' as const, id: `act-${a.Activity_ID}`, title: a.Activity_Name, path: entityPath('ACTIVITY', a.Activity_ID),
        subtitle: [a.Activity_ID, a.ProcInv_Class_Ref, a.Status].filter(Boolean).join(' · ')
      })) });
    }).catch(fail('Activities')),
    // warehouses come from the entity list (every user); areas need the storage list, a custodian-tier call
    apiRequest<{ rows: WarehouseListRow[] }>('entity:list', { scopeType: 'WAREHOUSE' }).then(r => {
      onPart({ warehouses: r.rows.map(w => ({ group: 'Warehouses' as const, id: `w-${w.id}`, title: w.name, subtitle: `Warehouse · ${w.id}`, path: entityPath('WAREHOUSE', w.id) })) });
    }).then(() => !access.custodian ? undefined : apiRequest<StorageOptions>('receiving:getStorageOptions').then(o => {
      onPart({ areas: o.storage.filter(s => s.storageType === 'AREA').map(s => ({
        group: 'Warehouses' as const, id: `w-${s.storageId}`, title: s.name, subtitle: `Area · ${s.storageId} · ${s.warehouseLocation}`, path: entityPath('AREA', s.storageId)
      })) });
    })).catch(fail('Warehouses')),
    apiRequest<{ rows: SubDepartmentListRow[] }>('entity:list', { scopeType: 'SUBDEPARTMENT' }).then(r => {
      onPart({ subDepartments: r.rows.map(d => ({ group: 'Sub-Departments' as const, id: `sd-${d.name}`, title: d.name, subtitle: 'Sub-Department', path: entityPath('SUBDEPARTMENT', d.name) })) });
    }).catch(fail('Sub-Departments'))
  ]);
}

/**
 * Case-insensitive match: every word of the query must appear in the title, subtitle or keywords.
 * Lower score ranks first: title starts with the query (0), title contains it (1), only the details match (2).
 */
export function searchEntries(entries: SearchResult[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  const words = q.split(/\s+/);
  const scored: { r: SearchResult; s: number }[] = [];
  for (const r of entries) {
    const title = r.title.toLowerCase();
    const hay = `${title} ${(r.subtitle || '').toLowerCase()} ${(r.keywords || '').toLowerCase()}`;
    if (!words.every(w => hay.includes(w))) continue;
    scored.push({ r, s: title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2 });
  }
  return scored.sort((a, b) => a.s - b.s).map(x => x.r); // Array.sort is stable: equal scores keep their order
}

const RECENT_MAX = 5;
const recentKey = (email: string) => `jjjei_search_recent_${email.toLowerCase()}`;

/** The user's last chosen results (newest first), kept in this browser per account. Never throws. */
export function loadRecent(email: string): SearchResult[] {
  try {
    const list = JSON.parse(localStorage.getItem(recentKey(email)) || '[]');
    return Array.isArray(list) ? list.slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

/** Remembers a chosen result: moves it to the front, keeps the latest 5. */
export function saveRecent(email: string, r: SearchResult): void {
  try {
    const list = [r, ...loadRecent(email).filter(x => x.id !== r.id)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(email), JSON.stringify(list));
  } catch { /* storage unavailable: recents are a convenience only */ }
}
