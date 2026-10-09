import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { DataTable, type Column } from '../../components/DataTable';
import type { AnalyticsGroup, AnalyticsOverviewResponse, AnalyticsRow } from '../../types';

const GROUPS: { key: AnalyticsGroup; label: string }[] = [
  { key: 'SUBDEPARTMENT', label: 'Sub-Department' },
  { key: 'ACTIVITY', label: 'Activity / Project' },
  { key: 'SYSTEM', label: 'System' },
  { key: 'COMPONENT', label: 'Component' }
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const peso = (n: number) => `₱${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

function period(kind: 'month' | 'quarter' | 'year') {
  const now = new Date();
  if (kind === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  if (kind === 'quarter') {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { from: iso(new Date(now.getFullYear(), q, 1)), to: iso(new Date(now.getFullYear(), q + 3, 0)) };
  }
  return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)) };
}

export const AnalyticsOverview: React.FC = () => {
  const initial = period('month');
  const [groupBy, setGroupBy] = useState<AnalyticsGroup>('SUBDEPARTMENT');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      setData(await apiRequest<AnalyticsOverviewResponse>('analytics:getOverview', { from, to, groupBy }));
    } catch (err: any) {
      setError(err.message || 'Failed to load the overview.');
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || []).filter(r => !q || r.label.toLowerCase().includes(q));
  }, [data, search]);

  const groupLabel = GROUPS.find(g => g.key === groupBy)!.label;
  const money = (key: keyof AnalyticsRow) => (r: AnalyticsRow) => peso(r[key] as number);
  const num = (key: keyof AnalyticsRow) => (r: AnalyticsRow) => qty(r[key] as number);
  const columns: Column<AnalyticsRow>[] = [
    { key: 'label', label: groupLabel, sortable: true, minWidth: '220px', render: r => <span className="fw-medium text-dark">{r.label}</span> },
    { key: 'issuedQty', label: 'Issued Qty', sortable: true, align: 'right', minWidth: '100px', render: num('issuedQty') },
    { key: 'issuedCost', label: 'Issued Cost', sortable: true, align: 'right', minWidth: '120px', render: money('issuedCost') },
    { key: 'consumedQty', label: 'Consumed Qty', sortable: true, align: 'right', minWidth: '110px', render: num('consumedQty') },
    { key: 'consumedCost', label: 'Consumed Cost', sortable: true, align: 'right', minWidth: '125px', render: money('consumedCost') },
    { key: 'receivedQty', label: 'Received Qty', sortable: true, align: 'right', minWidth: '110px', render: num('receivedQty') },
    { key: 'receivedCost', label: 'Received Cost', sortable: true, align: 'right', minWidth: '125px', render: money('receivedCost') },
    { key: 'onHandQty', label: 'On Hand Qty', sortable: true, align: 'right', minWidth: '105px', render: num('onHandQty') },
    { key: 'onHandValue', label: 'On Hand Value', sortable: true, align: 'right', minWidth: '125px', render: money('onHandValue') }
  ];

  const t = data?.totals;
  const stat = (label: string, value: string, sub?: string) => (
    <div className="col-6 col-lg-3">
      <div className="card border-0 shadow-sm h-100"><div className="card-body">
        <div className="small text-secondary">{label}</div>
        <div className="h5 fw-bold mb-0 text-dark">{value}</div>
        {sub && <small className="text-muted">{sub}</small>}
      </div></div>
    </div>
  );

  return (
    <div>
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold mb-1">From</label>
              <input type="date" className="form-control form-control-sm" value={from} max={to} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold mb-1">To</label>
              <input type="date" className="form-control form-control-sm" value={to} min={from} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="col-12 col-md-6 col-lg-8 d-flex flex-wrap gap-2">
              {(['month', 'quarter', 'year'] as const).map(k => (
                <button key={k} type="button" className="btn btn-secondary btn-sm" onClick={() => { const p = period(k); setFrom(p.from); setTo(p.to); }}>
                  This {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {stat('Issued', peso(t?.issuedCost || 0), `${qty(t?.issuedQty || 0)} units`)}
        {stat('Consumed', peso(t?.consumedCost || 0), `${qty(t?.consumedQty || 0)} units`)}
        {stat('Received', peso(t?.receivedCost || 0), `${qty(t?.receivedQty || 0)} units`)}
        {stat('Stock on hand', peso(t?.onHandValue || 0), `${qty(t?.onHandQty || 0)} units, as of ${data?.meta.stockAsOf || 'today'}`)}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card shadow-sm border-0">
        <DataTable
          columns={columns}
          data={rows}
          keyField="key"
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search"
          isLoading={loading}
          emptyMessage="No movements in this period."
          filters={
            <div className="btn-group btn-group-sm" role="group" aria-label="Group by">
              {GROUPS.map(g => (
                <button key={g.key} type="button" className={`btn ${groupBy === g.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGroupBy(g.key)}>{g.label}</button>
              ))}
            </div>
          }
        />
      </div>

      {data && data.meta.notes.length > 0 && (
        <div className="small text-secondary mt-3">
          {data.meta.notes.map((n, i) => <div key={i}>{n}</div>)}
        </div>
      )}
    </div>
  );
};
