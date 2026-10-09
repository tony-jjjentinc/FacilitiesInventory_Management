import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import type { TransactionEntry, WarehouseStockItem } from '../../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement);

const PALETTE = ['#184421', '#2f6f3e', '#5c9a6a', '#93bf9d', '#c5ddca', '#64748b', '#94a3b8', '#cbd5e1'];
const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const valueOf = (i: WarehouseStockItem) => Number(i.Valuation) || (Number(i.On_Hand_Qty || 0) * Number(i.Unit_Cost || 0)) || 0;

const ChartCard: React.FC<{ title: string; subtitle: string; empty: boolean; children: React.ReactNode }> = ({ title, subtitle, empty, children }) => (
  <div className="col-12 col-xl-6">
    <div className="card border shadow-sm h-100 bg-white">
      <div className="card-header bg-white border-bottom">
        <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>{title}</div>
        <div className="small text-muted" style={{ fontSize: '0.75rem' }}>{subtitle}</div>
      </div>
      <div className="card-body">
        <div style={{ height: '260px' }} className={empty ? 'd-flex align-items-center justify-content-center text-muted small' : ''}>
          {empty ? 'No data yet.' : children}
        </div>
      </div>
    </div>
  </div>
);

/** Analytics > Overview: the core inventory trackers as charts, from live stock balances and the ledger. */
export const AnalyticsTrackers: React.FC = () => {
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [history, setHistory] = useState<TransactionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchWithSwr('inventory:stock:all', () => apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock'), d => { if (alive && Array.isArray(d)) setStock(d); }),
      fetchWithSwr('transaction:history:ALL', () => apiRequest<TransactionEntry[]>('transaction:getHistory', { status: 'ALL' }), d => { if (alive && Array.isArray(d)) setHistory(d); })
    ]).catch(err => console.warn('Analytics overview fetch failed:', err)).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const data = useMemo(() => {
    // value by trade category (second part of the SKU: TYPE-CATEGORY-NNNN)
    const byCategory = new Map<string, number>();
    const byClass = new Map<string, number>();
    const byLocation = new Map<string, number>();
    const health: Record<string, number> = { NORMAL: 0, REORDER_WARNING: 0, CRITICAL_DEPLETION: 0 };
    stock.forEach(i => {
      const v = valueOf(i);
      const cat = (i.Item_SKU || '').split('-')[1] || 'Other';
      byCategory.set(cat, (byCategory.get(cat) || 0) + v);
      const cls = (i.Classification || 'Other').toUpperCase();
      byClass.set(cls, (byClass.get(cls) || 0) + 1);
      const loc = i.Warehouse_Location || 'Unspecified';
      byLocation.set(loc, (byLocation.get(loc) || 0) + v);
      health[i.ROP_Status] = (health[i.ROP_Status] || 0) + 1;
    });

    // last 6 calendar months of posted stock in / stock out
    const months: { key: string; label: string; inCost: number; outCost: number }[] = [];
    const now = new Date();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), inCost: 0, outCost: 0 });
    }
    history.filter(t => t.status === 'POSTED').forEach(t => {
      const d = new Date(t.timestamp);
      if (isNaN(d.getTime())) return;
      const m = months.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (!m) return;
      const cost = Number(t.totalCost) || 0;
      if (t.transactionType?.startsWith('IN:')) m.inCost += cost;
      else if (t.transactionType?.startsWith('OUT:')) m.outCost += cost;
    });

    const top = [...stock].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 8).filter(i => valueOf(i) > 0);
    return { byCategory, byClass, byLocation, health, months, top, total: stock.reduce((s, i) => s + valueOf(i), 0) };
  }, [stock, history]);

  const sorted = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  const doughnut = (entries: [string, number][]) => ({
    labels: entries.map(e => e[0]),
    datasets: [{ data: entries.map(e => Math.round(e[1])), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#ffffff' }]
  });
  const cat = sorted(data.byCategory);
  const cls = sorted(data.byClass);
  const loc = sorted(data.byLocation);
  const hasMonths = data.months.some(m => m.inCost > 0 || m.outCost > 0);
  const healthEntries: [string, number][] = [
    ['Normal', data.health.NORMAL || 0], ['Reorder warning', data.health.REORDER_WARNING || 0], ['Critical', data.health.CRITICAL_DEPLETION || 0]
  ];
  const healthTotal = healthEntries.reduce((s, e) => s + e[1], 0);
  const legend = { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } };

  return (
    <div>
      {loading && stock.length === 0 && (
        <div className="d-flex align-items-center gap-2 small text-secondary mb-3" role="status">
          <span className="spinner-border spinner-border-sm text-primary"></span> Loading the trackers…
        </div>
      )}
      <div className="row g-3">
        <ChartCard title="Stock value by trade category" subtitle={`Valuation of stock on hand, ${peso(data.total)} in total`} empty={cat.length === 0}>
          <Bar
            data={{ labels: cat.map(c => c[0]), datasets: [{ label: 'Valuation', data: cat.map(c => Math.round(c[1])), backgroundColor: '#184421', borderRadius: 4, maxBarThickness: 32 }] }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => peso(Number(c.raw)) } } },
              scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f5f9' }, ticks: { callback: v => `₱${(Number(v) / 1000).toFixed(0)}k` } } } }}
          />
        </ChartCard>

        <ChartCard title="Stock in vs stock out" subtitle="Posted ledger cost per month, last 6 months" empty={!hasMonths}>
          <Bar
            data={{ labels: data.months.map(m => m.label), datasets: [
              { label: 'Stock in', data: data.months.map(m => Math.round(m.inCost)), backgroundColor: '#184421', borderRadius: 3, maxBarThickness: 18 },
              { label: 'Stock out', data: data.months.map(m => Math.round(m.outCost)), backgroundColor: '#94a3b8', borderRadius: 3, maxBarThickness: 18 }
            ] }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${peso(Number(c.raw))}` } } },
              scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f5f9' }, ticks: { callback: v => `₱${(Number(v) / 1000).toFixed(0)}k` } } } }}
          />
        </ChartCard>

        <ChartCard title="Stock health" subtitle="Items by reorder-point status" empty={healthTotal === 0}>
          <Doughnut
            data={{ labels: healthEntries.map(e => e[0]), datasets: [{ data: healthEntries.map(e => e[1]), backgroundColor: ['#198754', '#f59f00', '#dc3545'], borderWidth: 2, borderColor: '#ffffff' }] }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend } }}
          />
        </ChartCard>

        <ChartCard title="Value by warehouse" subtitle="Where the stock value sits" empty={loc.length === 0 || data.total === 0}>
          <Doughnut data={doughnut(loc)} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend, tooltip: { callbacks: { label: c => `${c.label}: ${peso(Number(c.raw))}` } } } }} />
        </ChartCard>

        <ChartCard title="Items by classification" subtitle="Consumables, tools, spare parts and others (number of items)" empty={cls.length === 0}>
          <Doughnut data={doughnut(cls)} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend } }} />
        </ChartCard>

        <ChartCard title="Highest-value items" subtitle="Top 8 by stock valuation" empty={data.top.length === 0}>
          <Bar
            data={{ labels: data.top.map(i => i.Item_Name), datasets: [{ label: 'Valuation', data: data.top.map(i => Math.round(valueOf(i))), backgroundColor: '#2f6f3e', borderRadius: 4, maxBarThickness: 22 }] }}
            options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => peso(Number(c.raw)) } } },
              scales: { x: { grid: { color: '#f1f5f9' }, ticks: { callback: v => `₱${(Number(v) / 1000).toFixed(0)}k` } }, y: { grid: { display: false } } } }}
          />
        </ChartCard>
      </div>
    </div>
  );
};
