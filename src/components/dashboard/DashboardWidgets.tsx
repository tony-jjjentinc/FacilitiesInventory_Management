/**
 * @file DashboardWidgets.tsx
 * @description The dashboard's lower half: stock alerts, approvals, receipts awaiting confirmation, recent transactions,
 * inventory mix charts and the spend chart (plus the drafts list used by the Quick actions card). Each widget loads on its own, so one slow call never blocks the others.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import { getAccess } from '../../services/access';
import { getCurrentUser } from '../../services/auth';
import type { AnalyticsOverviewResponse, LossIncident, MixGroup, ReceiptRecord, TransactionEntry, WarehouseStockItem } from '../../types';
import { ChartCard, MixChart, PALETTE } from '../entity/charts';
import { entityPath, peso } from '../entity/entityPaths';
import { Loading } from '../Loading';
import type { DraftSummary } from '../drafts/useDraft';
import { pushRecent } from '../../services/recent';
import { fmtDate, fmtDateTime, toTimestamp, todayInputDate } from '../../utils/datetime';

interface CatalogMeta { ID: string; Inventory_Type_Name?: string; Category_Name?: string }

/** Card with a title and a "View all" link; shows a loader, an error or the empty text before the children. */
const Panel: React.FC<{ title: string; to?: string; state: 'loading' | 'ready' | 'error'; empty?: string; children: React.ReactNode }> = ({ title, to, state, empty, children }) => {
  const navigate = useNavigate();
  return (
    <div className="col-12 col-xl-6">
      <div className="card border shadow-sm h-100 bg-white">
        <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
          <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>{title}</div>
          {to && <button type="button" className="btn btn-link btn-sm p-0" onClick={() => navigate(to)}>View all</button>}
        </div>
        <div className="card-body p-0">
          {state === 'loading' && <Loading variant="text" label="Loading…" className="p-3" />}
          {state === 'error' && <div className="p-3 small text-muted">Couldn't load. Use Refresh above.</div>}
          {state === 'ready' && (empty ? <div className="p-3 small text-muted">{empty}</div> : children)}
        </div>
      </div>
    </div>
  );
};

/** One line in a widget. With `to` the whole line opens that page (the "View all" link stays for the list itself). */
const Row: React.FC<{ main: string; sub?: string; right?: React.ReactNode; to?: string }> = ({ main, sub, right, to }) => {
  const navigate = useNavigate();
  return (
  <li className={`list-group-item d-flex justify-content-between align-items-center gap-2${to ? ' list-group-item-action' : ''}`}
    {...(to ? { role: 'link', tabIndex: 0, style: { cursor: 'pointer' }, onClick: () => navigate(to), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(to); } } } : {})}>
    <div className="min-w-0"><div className="small fw-semibold text-truncate">{main}</div>{sub && <div className="small text-muted text-truncate">{sub}</div>}</div>
    {right && <div className="small text-nowrap">{right}</div>}
  </li>
  );
};

const DRAFT_LABEL: Record<string, { label: string; to: (id: string) => string; hint: (id: string) => string }> = {
  MRL_RECEIVE: { label: 'Material Release', to: id => `/deliveries?tab=receive-mrl&resume=${encodeURIComponent(id)}`, hint: id => `Opens MRL ${id} with your saved changes` },
  MANUAL_RECEIVE: { label: 'New Inventory', to: () => '/deliveries?tab=receive-manual&resume=1', hint: () => 'Opens the form with your saved changes' },
  STAGED_TX: { label: 'Staged transaction', to: id => `/analytics?tab=ledger&resume=${encodeURIComponent(id)}`, hint: id => `Opens the ${id} form with your saved changes` }
};
const expiresIn = (iso: string) => {
  const h = (toTimestamp(iso) - Date.now()) / 3600000;
  return h >= 1 ? `${Math.floor(h)} h left` : `${Math.max(1, Math.round(h * 60))} min left`;
};

/** Groups stock rows into a mix; `by` returns the group label for a row. */
function mix(rows: WarehouseStockItem[], by: (r: WarehouseStockItem) => string): MixGroup[] {
  const m = new Map<string, MixGroup>();
  rows.forEach(r => {
    const label = by(r) || 'Unassigned';
    const g = m.get(label) || { label, qty: 0, value: 0 };
    g.qty += Number(r.On_Hand_Qty) || 0;
    g.value += Number(r.Valuation) || 0;
    m.set(label, g);
  });
  return [...m.values()].sort((a, b) => b.value - a.value || b.qty - a.qty).slice(0, 8);
}

/** Runs `go` once, when the element first scrolls into view (keeps the slow analytics call off the first paint). */
function useWhenVisible(go: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { go(); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); go(); } });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/** Most rows any dashboard table shows; "View all" opens the full list. */
const ROWS = 5;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
type Span = 'month' | 'quarter' | 'year';
function range(kind: Span) {
  const n = new Date(todayInputDate() + 'T00:00:00'); // today in Manila, not the browser's zone
  if (kind === 'month') return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)) };
  if (kind === 'quarter') { const q = Math.floor(n.getMonth() / 3) * 3; return { from: iso(new Date(n.getFullYear(), q, 1)), to: iso(new Date(n.getFullYear(), q + 3, 0)) }; }
  return { from: iso(new Date(n.getFullYear(), 0, 1)), to: iso(new Date(n.getFullYear(), 11, 31)) };
}

/** Spend by sub-department for the chosen month, quarter or year. */
const SpendChart: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [span, setSpan] = useState<Span>('month');
  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [seen, setSeen] = useState(false);
  const ref = useWhenVisible(() => setSeen(true));

  useEffect(() => {
    if (!seen) return;
    const { from, to } = range(span);
    setState(s => (data ? s : 'loading'));
    fetchWithSwr<AnalyticsOverviewResponse>(
      `dash:spend:${from}:${to}`,
      () => apiRequest<AnalyticsOverviewResponse>('analytics:getOverview', { from, to, groupBy: 'SUBDEPARTMENT' }),
      d => { if (d && Array.isArray(d.rows)) { setData(d); setState('ready'); } },
      { persist: true }
    ).catch(() => setState('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, span, refreshKey]);

  const rows = (data?.rows || []).filter(r => r.receivedCost || r.issuedCost || r.consumedCost).slice(0, ROWS);
  return (
    <div className="col-12" ref={ref}>
      <div className="card border shadow-sm bg-white">
        <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Spend by sub-department</div>
            <div className="small text-muted">Received, issued and consumed cost for the period</div>
          </div>
          <select className="form-select form-select-sm w-auto" value={span} onChange={e => setSpan(e.target.value as Span)} aria-label="Period">
            <option value="month">This month</option><option value="quarter">This quarter</option><option value="year">This year</option>
          </select>
        </div>
        <div className="card-body" style={state === 'ready' && rows.length > 0 ? { height: '300px' } : undefined}>
          {state === 'error' ? <div className="small text-muted">Couldn't load. Use Refresh above.</div>
            : state !== 'ready' ? <Loading variant="text" label="Loading…" />
            : rows.length === 0 ? <div className="small text-muted">No spend in this period.</div>
            : <Bar
                data={{ labels: rows.map(r => r.label), datasets: [
                  { label: 'Received', data: rows.map(r => r.receivedCost), backgroundColor: PALETTE[3] },
                  { label: 'Issued', data: rows.map(r => r.issuedCost), backgroundColor: PALETTE[1] },
                  { label: 'Consumed', data: rows.map(r => r.consumedCost), backgroundColor: PALETTE[0] }
                ] }}
                options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${peso(Number(c.raw))}` } } } }}
              />}
        </div>
      </div>
    </div>
  );
};

export interface DashboardWidgetsProps {
  stock: WarehouseStockItem[];
  stockState: 'loading' | 'ready' | 'error';
  incidents: LossIncident[];
  /** bumped by the dashboard's Refresh button */
  refreshKey: number;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ stock, stockState, incidents, refreshKey }) => {
  const access = getAccess(getCurrentUser());
  const showTransactions = access.canSeeAnalytics; // the ledger lives in Analytics
  const showSpend = access.canSeeAnalytics && access.canSeeCosts;

  const [txns, setTxns] = useState<TransactionEntry[] | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRecord[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogMeta[]>([]);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const fail = (k: string) => () => setFailed(f => ({ ...f, [k]: true }));
  const st = (data: unknown, k: string): 'loading' | 'ready' | 'error' => (data ? 'ready' : failed[k] ? 'error' : 'loading');

  useEffect(() => {
    const persist = { persist: true };
    if (showTransactions) {
      fetchWithSwr<TransactionEntry[]>('dash:transactions', () => apiRequest<TransactionEntry[]>('transaction:getHistory', { status: 'POSTED', limit: ROWS }),
        d => { if (Array.isArray(d)) setTxns(d.slice(0, ROWS)); }, persist).catch(fail('txn')); // slice: an older API ignores `limit`
    }
    if (access.canField) {
      fetchWithSwr<ReceiptRecord[]>('dash:receipts', () => apiRequest<ReceiptRecord[]>('receiving:getPending', { limit: ROWS }),
        d => { if (Array.isArray(d)) setReceipts(d.slice(0, ROWS)); }, persist).catch(fail('rcpt'));
    }
    fetchWithSwr<CatalogMeta[]>('catalog:items', () => apiRequest<CatalogMeta[]>('catalog:getItems'),
      d => { if (Array.isArray(d)) setCatalog(d); }, persist).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const alerts = useMemo(() => stock.filter(r => r.ROP_Status !== 'NORMAL')
    .sort((a, b) => Number(b.ROP_Status === 'CRITICAL_DEPLETION') - Number(a.ROP_Status === 'CRITICAL_DEPLETION')).slice(0, ROWS), [stock]);
  const meta = useMemo(() => new Map(catalog.map(c => [c.ID, c])), [catalog]);
  const byQty = !access.canSeeCosts;
  const mixes = useMemo(() => ({
    type: mix(stock, r => meta.get(r.Item_ID)?.Inventory_Type_Name || r.Classification),
    category: mix(stock, r => meta.get(r.Item_ID)?.Category_Name || ''),
    warehouse: mix(stock, r => r.Warehouse_Name || r.Warehouse_Location)
  }), [stock, meta]);

  const awaiting = (receipts || []).filter(r => r.Status === 'PENDING_CONFIRMATION');

  return (
    <div className="row g-3 mb-4">
      {/* the pie charts come first, above the lists */}
      {stockState === 'ready' && stock.length > 0 && (
        <>
          <ChartCard pie third title="Stock by type" subtitle={byQty ? 'On-hand quantity' : 'Stock value'} empty={mixes.type.length === 0}><MixChart groups={mixes.type} byQty={byQty} /></ChartCard>
          <ChartCard pie third title="Stock by category" subtitle={byQty ? 'On-hand quantity' : 'Stock value'} empty={mixes.category.length === 0}><MixChart groups={mixes.category} byQty={byQty} /></ChartCard>
          <ChartCard pie third title="Stock by warehouse" subtitle={byQty ? 'On-hand quantity' : 'Stock value'} empty={mixes.warehouse.length === 0}><MixChart groups={mixes.warehouse} byQty={byQty} /></ChartCard>
        </>
      )}

      <Panel title="Stock alerts" to="/inventory?tab=alerts" state={stockState} empty={alerts.length === 0 ? 'No items need reordering.' : undefined}>
        <ul className="list-group list-group-flush">
          {alerts.map(r => <Row key={r.Inventory_ID} to={entityPath('ITEM', r.Item_ID)} main={r.Item_Name} sub={r.Warehouse_Name || r.Warehouse_Location}
            right={<><span className={`badge ${r.ROP_Status === 'CRITICAL_DEPLETION' ? 'text-bg-danger' : 'text-bg-warning'} me-2`}>{r.ROP_Status === 'CRITICAL_DEPLETION' ? 'Critical' : 'Reorder'}</span>{r.On_Hand_Qty} {r.UOM}</>} />)}
        </ul>
      </Panel>

      {access.isAdmin && (
        <Panel title="Pending approvals" to="/admin" state="ready" empty={incidents.length === 0 ? 'Nothing waiting for approval.' : undefined}>
          <ul className="list-group list-group-flush">
            {incidents.slice(0, ROWS).map(i => <Row key={i.lossId} to="/admin" main={`${i.lossType} · ${i.lossId}`} sub={i.incidentDescription} right={fmtDate(i.incidentDate)} />)}
          </ul>
        </Panel>
      )}

      {access.canField && (
        <Panel title="Receipts awaiting confirmation" to="/deliveries?tab=tasks" state={st(receipts, 'rcpt')} empty={awaiting.length === 0 ? 'No receipts are waiting.' : undefined}>
          <ul className="list-group list-group-flush">
            {awaiting.map(r => <Row key={r.Receipt_ID} to="/deliveries?tab=tasks" main={`${r.Source_Reference || r.Receipt_ID}`} sub={r.Project_Name || r.Warehouse_Location} right={`${r.items.length} ${r.items.length === 1 ? 'line' : 'lines'}`} />)}
          </ul>
        </Panel>
      )}

      {showTransactions && (
        <Panel title="Recent transactions" to="/analytics?tab=ledger" state={st(txns, 'txn')} empty={txns && txns.length === 0 ? 'No transactions yet.' : undefined}>
          <ul className="list-group list-group-flush">
            {(txns || []).map(t => <Row key={t.transactionId} to="/analytics?tab=ledger" main={`${t.transactionType} · ${t.transactionId}`} sub={fmtDateTime(t.timestamp)}
              right={access.canSeeCosts ? peso(t.totalCost) : `${t.totalItems} ${t.totalItems === 1 ? 'line' : 'lines'}`} />)}
          </ul>
        </Panel>
      )}

      {showSpend && <SpendChart refreshKey={refreshKey} />}
    </div>
  );
};

/** The person's saved drafts, for the Quick actions card. Never cached (they change as forms are edited); shows a quiet placeholder while loading. */
export const DraftsList: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const access = getAccess(getCurrentUser());
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  useEffect(() => {
    if (!(access.isCustodian || access.canField)) { setDrafts([]); return; }
    // the staged form lives in the Ledger (Analytics), so those drafts are hidden without it
    apiRequest<DraftSummary[]>('draft:list', {}).then(d => { if (Array.isArray(d)) setDrafts(access.canSeeAnalytics ? d : d.filter(x => x.formType !== 'STAGED_TX')); }).catch(() => setDrafts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);
  if (drafts === null) return <div className="small text-muted">Loading…</div>;
  if (drafts.length === 0) return <div className="small text-muted">No saved drafts.</div>;
  return (
    <ul className="list-unstyled mb-0 small">
      {drafts.slice(0, ROWS).map(d => {
        const info = DRAFT_LABEL[d.formType];
        return (
          <li key={d.draftId} className="d-flex justify-content-between align-items-center gap-2 py-1">
            <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none text-start text-truncate" title={info ? info.hint(d.identifier) : ''} onClick={() => { if (!info) return; const to = info.to(d.identifier); pushRecent(access.id || access.email, { label: `${info.label}${d.identifier ? ` · ${d.identifier}` : ''} (draft)`, to }); navigate(to); }}>
              {info?.label || d.formType}{d.identifier ? ` · ${d.identifier}` : ''}
            </button>
            <span className="text-muted text-nowrap">{expiresIn(d.expiresAt)}</span>
          </li>
        );
      })}
    </ul>
  );
};
