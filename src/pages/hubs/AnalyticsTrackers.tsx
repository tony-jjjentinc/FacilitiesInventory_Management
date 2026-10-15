import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, ChartCard, COLOR, DoughnutChart, HEALTH } from '../../components/charts';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import type { TransactionEntry, WarehouseStockItem } from '../../types';
import { parseDateTime, todayInputDate } from '../../utils/datetime';
import { pesoK, pesoWhole } from '../../utils/format';

const valueOf = (i: WarehouseStockItem) => Number(i.Valuation) || (Number(i.On_Hand_Qty || 0) * Number(i.Unit_Cost || 0)) || 0;


/** Analytics > Overview: the core inventory trackers as charts, from live stock balances and the ledger. */
export const AnalyticsTrackers: React.FC = () => {
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [history, setHistory] = useState<TransactionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"

  useEffect(() => {
    let alive = true;
    setLoading(true); setFailure('');
    Promise.all([
      fetchWithSwr('inventory:stock:all', () => apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock'), d => { if (alive && Array.isArray(d)) setStock(d); }),
      fetchWithSwr('transaction:history:ALL', () => apiRequest<TransactionEntry[]>('transaction:getHistory', { status: 'ALL' }), d => { if (alive && Array.isArray(d)) setHistory(d); })
    ]).catch(err => { console.warn('Analytics overview fetch failed:', err); if (alive) setFailure(String(err?.message || 'The data did not load.')); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attempt]);

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
    const now = new Date(todayInputDate() + 'T00:00:00');
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), inCost: 0, outCost: 0 });
    }
    history.filter(t => t.status === 'POSTED').forEach(t => {
      const p = parseDateTime(t.timestamp);
      if (!p) return;
      const d = new Date(p.y, p.mo - 1, 1); // the ledger month as written in Manila
      const m = months.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (!m) return;
      const cost = Number(t.totalCost) || 0;
      if (t.transactionType?.startsWith('IN:')) m.inCost += cost;
      else if (t.transactionType?.startsWith('OUT:')) m.outCost += cost;
    });

    const top = [...stock].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 8).filter(i => valueOf(i) > 0);
    return { byCategory, byClass, byLocation, health, months, top, total: stock.reduce((s, i) => s + valueOf(i), 0) };
  }, [stock, history]);

  // the charts show a skeleton while nothing has loaded, and a message with a retry when the load failed and there is nothing to draw
  const status = stock.length === 0 && history.length === 0 ? (loading ? 'loading' : failure ? 'error' : 'ready') : 'ready';
  const chartState = { status: status as 'loading' | 'ready' | 'error', error: failure, onRetry: () => setAttempt(n => n + 1) };
  const sorted = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  const cat = sorted(data.byCategory);
  const cls = sorted(data.byClass);
  const loc = sorted(data.byLocation);
  const hasMonths = data.months.some(m => m.inCost > 0 || m.outCost > 0);
  const healthEntries: [string, number][] = [
    ['Normal', data.health.NORMAL || 0], ['Reorder warning', data.health.REORDER_WARNING || 0], ['Critical', data.health.CRITICAL_DEPLETION || 0]
  ];
  const healthTotal = healthEntries.reduce((s, e) => s + e[1], 0);

  return (
    <div>
      {loading && stock.length === 0 && (
        <div className="d-flex align-items-center gap-2 small text-secondary mb-3" role="status">
          <span className="spinner-border spinner-border-sm text-primary"></span> Loading the trackers…
        </div>
      )}
      <div className="row g-3">
        <ChartCard {...chartState} title="Stock value by trade category" subtitle={`Valuation of stock on hand, ${pesoWhole(data.total)} in total`} empty={cat.length === 0}>
          <BarChart labels={cat.map(c => c[0])} legend={false} lightGrid thickness={32} format={pesoWhole} tickFormat={pesoK}
            series={[{ label: 'Valuation', data: cat.map(c => Math.round(c[1])), color: COLOR.strong }]} />
        </ChartCard>

        <ChartCard {...chartState} title="Stock in vs stock out" subtitle="Posted ledger cost per month, last 6 months" empty={!hasMonths}>
          <BarChart labels={data.months.map(m => m.label)} legend="bottom" lightGrid thickness={18} format={pesoWhole} tickFormat={pesoK} series={[
            { label: 'Stock in', data: data.months.map(m => Math.round(m.inCost)), color: COLOR.strong },
            { label: 'Stock out', data: data.months.map(m => Math.round(m.outCost)), color: COLOR.out }
          ]} />
        </ChartCard>

        <ChartCard pie {...chartState} title="Stock health" subtitle="Items by reorder-point status" empty={healthTotal === 0}>
          <DoughnutChart labels={healthEntries.map(e => e[0])} values={healthEntries.map(e => e[1])} colors={HEALTH} legend="bottom" separated />
        </ChartCard>

        <ChartCard pie {...chartState} title="Value by warehouse" subtitle="Where the stock value sits" empty={loc.length === 0 || data.total === 0}>
          <DoughnutChart labels={loc.map(e => e[0])} values={loc.map(e => Math.round(e[1]))} format={pesoWhole} legend="bottom" separated />
        </ChartCard>

        <ChartCard pie {...chartState} title="Items by classification" subtitle="Consumables, tools, spare parts and others (number of items)" empty={cls.length === 0}>
          <DoughnutChart labels={cls.map(e => e[0])} values={cls.map(e => Math.round(e[1]))} legend="bottom" separated />
        </ChartCard>

        <ChartCard {...chartState} title="Highest-value items" subtitle="Top 8 by stock valuation" empty={data.top.length === 0}>
          <BarChart horizontal labels={data.top.map(i => i.Item_Name)} legend={false} lightGrid thickness={22} format={pesoWhole} tickFormat={pesoK}
            series={[{ label: 'Valuation', data: data.top.map(i => Math.round(valueOf(i))), color: COLOR.in }]} />
        </ChartCard>
      </div>
    </div>
  );
};
