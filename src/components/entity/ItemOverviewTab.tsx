/**
 * @file ItemOverviewTab.tsx
 * @description Inventory item overview: purchase price history, supplier prices, reorder status and usage rate with days of cover.
 */
import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Loading } from '../Loading';
import { RefreshButton } from '../RefreshButton';
import type { ItemOverview } from '../../types';
import { peso, qty } from './entityPaths';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { useEntityData } from './useEntity';
import { fmtDate, fmtDateTime } from '../../utils/datetime';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const ROP: Record<string, string> = { NORMAL: 'Normal', REORDER_WARNING: 'Reorder soon', CRITICAL_DEPLETION: 'Critical' };

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = 'col-12 col-xl-6' }) => (
  <div className={className}>
    <div className="card border shadow-sm h-100 bg-white">
      <div className="card-header bg-white border-bottom">
        <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>{title}</div>
        {subtitle && <div className="small text-muted" style={{ fontSize: '0.75rem' }}>{subtitle}</div>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  </div>
);

const none = <div className="d-flex align-items-center justify-content-center text-muted small" style={{ height: '220px' }}>No Data</div>;

export const ItemOverviewTab: React.FC<{ itemId: string; onOpenTab?: (key: string) => void }> = ({ itemId, onOpenTab }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<ItemOverview>('getOverview', 'ITEM', itemId);
  const costs = getAccess(getCurrentUser()).canSeeCosts;
  if (loading && !data) return <Loading label="Loading the overview…" />;
  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  if (!data) return null;
  const { usage, stock } = data;
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="small text-muted">
          Reorder status <strong className="text-dark">{ROP[stock.status] || '–'}</strong>
          {' · '}Average use <strong className="text-dark">{qty(usage.avgMonthly)} {data.uom}/month</strong>
          {' · '}Cover <strong className="text-dark">{usage.daysOfCover === null ? '–' : `${usage.daysOfCover} days`}</strong>
        </div>
        <div className="d-flex align-items-center gap-3">{onOpenTab && <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => onOpenTab('distribution')}>Where is it? <i className="bi bi-arrow-right"></i></button>}<RefreshButton onClick={reload} loading={refreshing} /></div>
      </div>
      <div className="row g-3">
        {costs && <Card title="Price paid per unit" subtitle="Each purchase of this item, oldest first">
          {data.received.length === 0 ? none : (
            <div style={{ height: '220px' }}>
              <Line
                data={{ labels: data.received.map(r => r.at), datasets: [{ label: 'Unit cost', data: data.received.map(r => r.unitCost), borderColor: '#184421', backgroundColor: '#184421', tension: 0.2 }] }}
                options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => peso(Number(c.raw)) } } }, scales: { y: { ticks: { callback: v => peso(Number(v)) } } } }}
              />
            </div>
          )}
        </Card>}
        <Card title="Usage per month" subtitle="Issued to activities and consumed, last 6 months">
          {usage.issued.every(v => v === 0) && usage.consumed.every(v => v === 0) ? none : (
            <div style={{ height: '220px' }}>
              <Bar
                data={{ labels: usage.labels, datasets: [
                  { label: 'Issued', data: usage.issued, backgroundColor: '#2f6f3e' },
                  { label: 'Consumed', data: usage.consumed, backgroundColor: '#94a3b8' }
                ] }}
                options={{ maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }}
              />
            </div>
          )}
        </Card>
        {costs && <Card title="Supplier prices" subtitle="From the item's price cards">
          {data.suppliers.length === 0 ? <div className="text-muted small">No Data</div> : (
            <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead className="table-light"><tr><th>Supplier</th><th className="text-end">Price</th><th>Effective</th></tr></thead>
              <tbody>
                {data.suppliers.map(s => (
                  <tr key={s.supplierId}>
                    <td>{s.supplierName}{s.preferred && <span className="badge text-bg-light border fw-normal ms-2">Preferred</span>}</td>
                    <td className="text-end">{peso(s.price)}</td>
                    <td>{fmtDate(s.effectiveDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>}
        <Card title="Stock by warehouse" subtitle={`${qty(stock.onHand)} ${data.uom} on hand`}>
          {stock.byWarehouse.length === 0 ? <div className="text-muted small">Nothing on hand.</div> : (
            <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead className="table-light"><tr><th>Warehouse</th><th className="text-end">On hand</th>{costs && <th className="text-end">Value</th>}</tr></thead>
              <tbody>{stock.byWarehouse.map(w => <tr key={w.label}><td>{w.label}</td><td className="text-end">{qty(w.qty)}</td>{costs && <td className="text-end">{peso(w.value)}</td>}</tr>)}</tbody>
            </table>
          )}
        </Card>
        {costs && data.corrections.length > 0 && (
          <Card title="Price corrections" className="col-12">
            <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead className="table-light"><tr><th>Date</th><th className="text-end">From</th><th className="text-end">To</th><th className="text-end">Units</th><th>Reason</th></tr></thead>
              <tbody>{data.corrections.map((c, i) => <tr key={i}><td>{fmtDateTime(c.at)}</td><td className="text-end">{peso(c.oldCost)}</td><td className="text-end">{peso(c.newCost)}</td><td className="text-end">{qty(c.qty)}</td><td>{c.reason || '–'}</td></tr>)}</tbody>
            </table>
          </Card>
        )}
      </div>
      {data.meta.notes.map(n => <div key={n} className="small text-muted mt-2">{n}</div>)}
    </>
  );
};
