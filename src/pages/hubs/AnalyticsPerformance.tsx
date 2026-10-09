import React, { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { apiRequest } from '../../services/api';
import { RefreshButton } from '../../components/RefreshButton';
import type { AnalyticsGroup, AnalyticsPeriod, AnalyticsPerformanceResponse, PerformanceCell } from '../../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const GROUPS: { key: AnalyticsGroup; label: string }[] = [
  { key: 'SUBDEPARTMENT', label: 'Sub-Department' },
  { key: 'SYSTEM', label: 'System' },
  { key: 'ACTIVITY_TYPE', label: 'Activity Category' }
];
const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'MONTH', label: 'Monthly' },
  { key: 'QUARTER', label: 'Quarterly' },
  { key: 'YEAR', label: 'Yearly' }
];
const MEASURES = [
  { key: 'issued', label: 'Issued to activities' },
  { key: 'consumed', label: 'Consumed' },
  { key: 'received', label: 'Received' }
] as const;
type Measure = typeof MEASURES[number]['key'];

const COLORS = ['#184421', '#2f6f3e', '#5c9a6a', '#93bf9d', '#64748b', '#94a3b8', '#b45309', '#cbd5e1'];
const MAX_SERIES = 6;
const peso = (n: number) => `₱${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

const pick = (c: PerformanceCell | undefined, measure: Measure, metric: 'qty' | 'cost') =>
  c ? Number(c[`${measure}${metric === 'qty' ? 'Qty' : 'Cost'}` as keyof PerformanceCell]) || 0 : 0;

/** Analytics > Performance: quantity and cost per month, quarter or year, by sub-department, system or activity category. */
export const AnalyticsPerformance: React.FC = () => {
  const [groupBy, setGroupBy] = useState<AnalyticsGroup>('SUBDEPARTMENT');
  const [period, setPeriod] = useState<AnalyticsPeriod>('MONTH');
  const [measure, setMeasure] = useState<Measure>('issued');
  const [metric, setMetric] = useState<'qty' | 'cost'>('cost');
  const [data, setData] = useState<AnalyticsPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiRequest<AnalyticsPerformanceResponse>('analytics:getPerformance', { groupBy, period }));
    } catch (err: any) {
      setError(err.message || 'Could not load the analytics.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [groupBy, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number) => (metric === 'cost' ? peso(n) : num(n));

  const chart = useMemo(() => {
    if (!data) return null;
    const ranked = [...data.rows].sort((a, b) => pick(b.totals, measure, metric) - pick(a.totals, measure, metric));
    const top = ranked.slice(0, MAX_SERIES);
    const rest = ranked.slice(MAX_SERIES);
    const datasets = top.map((r, i) => ({
      label: r.label, data: data.buckets.map(b => pick(r.cells[b.key], measure, metric)), backgroundColor: COLORS[i % COLORS.length], borderRadius: 2
    }));
    if (rest.length) {
      datasets.push({ label: 'Others', data: data.buckets.map(b => rest.reduce((s, r) => s + pick(r.cells[b.key], measure, metric), 0)), backgroundColor: '#e2e8f0', borderRadius: 2 });
    }
    return { labels: data.buckets.map(b => b.label), datasets };
  }, [data, measure, metric]);

  const hasData = !!data && data.rows.length > 0 && pick(data.totals, measure, metric) > 0;
  const measureLabel = MEASURES.find(m => m.key === measure)!.label;

  return (
    <div>
      <div className="card border shadow-sm bg-white mb-4">
        <div className="card-body py-3 d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label small fw-semibold mb-1" htmlFor="perf-group">Group by</label>
            <select id="perf-group" className="form-select form-select-sm" value={groupBy} onChange={e => setGroupBy(e.target.value as AnalyticsGroup)}>
              {GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1" htmlFor="perf-period">Period</label>
            <select id="perf-period" className="form-select form-select-sm" value={period} onChange={e => setPeriod(e.target.value as AnalyticsPeriod)}>
              {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1" htmlFor="perf-measure">Show</label>
            <select id="perf-measure" className="form-select form-select-sm" value={measure} onChange={e => setMeasure(e.target.value as Measure)}>
              {MEASURES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <div className="form-label small fw-semibold mb-1">Metric</div>
            <div className="btn-group btn-group-sm" role="group" aria-label="Metric">
              <button type="button" className={`btn ${metric === 'qty' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMetric('qty')}>Quantity</button>
              <button type="button" className={`btn ${metric === 'cost' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMetric('cost')}>Cost</button>
            </div>
          </div>
          <div className="ms-auto"><RefreshButton onClick={load} loading={loading} /></div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {loading && !data && (
        <div className="d-flex align-items-center gap-2 small text-secondary mb-3" role="status">
          <span className="spinner-border spinner-border-sm text-primary"></span> Loading…
        </div>
      )}

      {data && (
        <>
          <div className="card border shadow-sm bg-white mb-4">
            <div className="card-header bg-white border-bottom">
              <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                {measureLabel}: {metric === 'cost' ? 'cost' : 'quantity'} per {PERIODS.find(p => p.key === period)!.label.toLowerCase().replace('ly', '')}
              </div>
              <div className="small text-muted" style={{ fontSize: '0.75rem' }}>{data.from} to {data.to}, by {GROUPS.find(g => g.key === groupBy)!.label}</div>
            </div>
            <div className="card-body">
              <div style={{ height: '300px' }} className={hasData ? '' : 'd-flex align-items-center justify-content-center text-muted small'}>
                {hasData && chart ? (
                  <Bar data={chart} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(Number(c.raw))}` } } },
                    scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => (metric === 'cost' ? `₱${(Number(v) / 1000).toFixed(0)}k` : String(v)) } } }
                  }} />
                ) : 'No data for this period.'}
              </div>
            </div>
          </div>

          <div className="card border shadow-sm bg-white overflow-hidden">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: '180px' }}>{GROUPS.find(g => g.key === groupBy)!.label}</th>
                    {data.buckets.map(b => <th key={b.key} className="text-end text-nowrap">{b.label}</th>)}
                    <th className="text-end text-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && <tr><td colSpan={data.buckets.length + 2} className="text-center text-muted py-4">No movements in this range.</td></tr>}
                  {data.rows.map(r => (
                    <tr key={r.label}>
                      <td className="fw-medium text-dark">{r.label}</td>
                      {data.buckets.map(b => {
                        const v = pick(r.cells[b.key], measure, metric);
                        return <td key={b.key} className="text-end text-nowrap">{v ? fmt(v) : <span className="text-muted">—</span>}</td>;
                      })}
                      <td className="text-end text-nowrap fw-semibold">{fmt(pick(r.totals, measure, metric))}</td>
                    </tr>
                  ))}
                </tbody>
                {data.rows.length > 0 && (
                  <tfoot>
                    <tr className="table-light fw-semibold">
                      <td>Total</td>
                      {data.buckets.map(b => <td key={b.key} className="text-end text-nowrap">{fmt(pick(data.bucketTotals[b.key], measure, metric))}</td>)}
                      <td className="text-end text-nowrap">{fmt(pick(data.totals, measure, metric))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          {data.meta.notes.map(n => <div key={n} className="small text-muted mt-2">{n}</div>)}
        </>
      )}
    </div>
  );
};
