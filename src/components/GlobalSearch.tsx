/**
 * @file GlobalSearch.tsx
 * @description General search overlay: actions, pages and data (inventory items, activities, warehouses and areas, sub-departments).
 * Choosing a data result opens its entity page (/items/:id, /activities/:id, /warehouses/:id, /areas/:id, /sub-departments/:name).
 *
 * USAGE
 *   const [open, setOpen] = useState(false);
 *   <button onClick={() => setOpen(true)}>Search</button>
 *   <GlobalSearch open={open} onClose={() => setOpen(false)} onSelect={r => console.log(r)} />
 *
 * BEHAVIOUR
 *   - Opens as a modal-like panel (backdrop, search field at the top center); the page behind does not scroll.
 *   - Empty field: a "Recent" group (the last 5 results this user chose, kept per account in this browser)
 *     comes first, then all actions and pages. Typing: each group shows its 5 best matches,
 *     plus "N more" when there are extra; the field is debounced by 150 ms.
 *   - Keyboard: Up/Down moves through the results across all groups, Enter opens, Esc closes.
 *   - Choosing a result navigates to its page, closes the panel and calls `onSelect`.
 *   - Data loads once, on the first open. Each source loads independently: a group shows "Loading…" or its own
 *     error while the others stay usable. Actions and pages follow the user's role like the routes do.
 *   - Matching and ranking live in globalSearchSources.ts.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import { Loading } from './Loading';
import { GROUP_ORDER, loadRecent, loadSearchData, saveRecent, searchAccess, searchEntries, staticEntries, type SearchData, type SearchGroup, type SearchResult } from './globalSearchSources';

const PER_GROUP = 5;
const DEBOUNCE_MS = 150;
const EMPTY: SearchData = { items: [], activities: [], warehouses: [], areas: [], subDepartments: [], errors: {} };

interface Props {
  open: boolean;
  onClose: () => void;
  /** called after navigation, e.g. to log or track what was chosen */
  onSelect?: (result: SearchResult) => void;
}

export const GlobalSearch: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState<SearchData>(EMPTY);
  const [loaded, setLoaded] = useState<Set<SearchGroup>>(new Set());
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const started = useRef(false);
  const activeRow = useRef<HTMLButtonElement | null>(null);

  const user = getCurrentUser();
  const access = useMemo(() => searchAccess(user), [user]);

  // load the data once, on the first open
  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    loadSearchData(access, patch => {
      setData(d => ({ ...d, ...patch, errors: { ...d.errors, ...patch.errors } }));
      setLoaded(s => new Set([...s, ...(patch.items ? ['Inventory items' as const] : []), ...(patch.activities ? ['Activities' as const] : []), ...(patch.warehouses ? ['Warehouses' as const] : []), ...(patch.subDepartments ? ['Sub-Departments' as const] : [])]));
    }).then(() => setLoaded(new Set(GROUP_ORDER))); // every source has finished or failed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  // lock page scroll while open, and start clean each time
  useEffect(() => {
    if (!open) return;
    setQuery(''); setDebounced(''); setActive(0);
    setRecent(loadRecent(user?.email || ''));
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pool = useMemo(() => [...staticEntries(access), ...data.items, ...data.activities, ...data.warehouses, ...data.areas, ...data.subDepartments], [access, data]);
  const matches = useMemo(() => searchEntries(pool, debounced), [pool, debounced]);

  // top results per group; the flat list is what the keyboard walks through
  const groups = useMemo(() => {
    const byGroup = GROUP_ORDER.map(g => {
      const all = matches.filter(r => r.group === g);
      return { group: g as string, rows: all.slice(0, PER_GROUP), more: Math.max(0, all.length - PER_GROUP) };
    });
    // recents only while the field is empty; entries the user may no longer open (role change) are dropped
    const allowed = new Set(staticEntries(access).map(r => r.id));
    const recents = recent.filter(r => r.group === 'Actions' || r.group === 'Pages' ? allowed.has(r.id) : true);
    return debounced.trim() === '' && recents.length ? [{ group: 'Recent', rows: recents, more: 0 }, ...byGroup] : byGroup;
  }, [matches, recent, access, debounced]);
  const flat = useMemo(() => groups.flatMap(g => g.rows), [groups]);

  useEffect(() => { setActive(0); }, [debounced]);
  useEffect(() => { activeRow.current?.scrollIntoView({ block: 'nearest' }); }, [active]);

  if (!open) return null;

  const choose = (r: SearchResult) => { saveRecent(user?.email || '', r); onClose(); navigate(r.path); onSelect?.(r); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); choose(flat[active]); }
  };

  const searching = debounced.trim() !== '';
  const stillLoading = (g: string) => !loaded.has(g as SearchGroup) && !data.errors[g as SearchGroup] && (g === 'Inventory items' || g === 'Activities' || g === 'Warehouses' || g === 'Sub-Departments');
  let rowIndex = -1;

  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-label="Search"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1070 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-auto px-3" style={{ maxWidth: '640px', marginTop: '12vh' }} onKeyDown={onKeyDown}>
        <div className="bg-white border shadow">
          <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom">
            <i className="bi bi-search text-muted" aria-hidden="true"></i>
            <input autoFocus type="search" className="form-control form-control-sm border-0 shadow-none" placeholder="Search items, activities, warehouses, pages, actions…"
              aria-label="Search" value={query} onChange={e => setQuery(e.target.value)} />
            <kbd className="small">Esc</kbd>
          </div>

          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {searching && flat.length === 0 && GROUP_ORDER.every(g => !stillLoading(g)) && (
              <div className="text-center text-muted small py-4">No results for “{debounced.trim()}”. Try an ID, SKU or name.</div>
            )}
            {groups.map(({ group, rows, more }) => {
              const loading = stillLoading(group);
              const error = data.errors[group as SearchGroup];
              if (rows.length === 0 && !loading && !error) return null;
              return (
                <div key={group} className="py-1">
                  <div className="px-3 py-1 small fw-semibold text-muted text-uppercase" style={{ fontSize: '0.7rem' }}>{group}</div>
                  {rows.map(r => {
                    rowIndex += 1;
                    const idx = rowIndex;
                    return (
                      <button key={`${group}-${r.id}`} type="button" ref={idx === active ? activeRow : null}
                        className={`d-block w-100 text-start border-0 px-3 py-2 ${idx === active ? 'bg-primary-subtle' : 'bg-white'}`}
                        onMouseEnter={() => setActive(idx)} onClick={() => choose(r)}>
                        <div className="small fw-semibold text-dark">{r.title}</div>
                        {(r.subtitle || group === 'Recent') && <div className="small text-muted">{group === 'Recent' ? `${r.group}${r.subtitle ? ' · ' : ''}` : ''}{r.subtitle}</div>}
                      </button>
                    );
                  })}
                  {more > 0 && <div className="px-3 py-1 small text-muted">{more} more — refine your search</div>}
                  {loading && <div className="px-3 py-1 small"><Loading variant="text" label="Loading…" /></div>}
                  {error && <div className="px-3 py-1 small text-danger">Could not load {group.toLowerCase()}: {error}</div>}
                </div>
              );
            })}
          </div>

          <div className="d-flex gap-3 px-3 py-2 border-top bg-light small text-muted justify-content-center">
            <span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
