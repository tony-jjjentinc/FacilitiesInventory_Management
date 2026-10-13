/**
 * @file EntityOverviewTab.tsx
 * @description Overview charts for a warehouse or an area: type and category mix, cost handled per month, stock age.
 * The same component serves both pages; only the scope differs.
 */
import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Loading } from '../Loading';
import { RefreshButton } from '../RefreshButton';
import type { EntityOverview, EntityScopeType } from '../../types';
import { ChartCard, MixChart } from './charts';
import { peso } from './entityPaths';
import { useEntityData } from './useEntity';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';

interface Props { scopeType: EntityScopeType; scopeRef: string; onOpenTab?: (key: string) => void }

export const EntityOverviewTab: React.FC<Props> = ({ scopeType, scopeRef, onOpenTab }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<EntityOverview>('getOverview', scopeType, scopeRef);
  const costs = getAccess(getCurrentUser()).canSeeCosts;
  if (loading && !data) return <Loading label="Loading the overview…" />;
  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  if (!data) return null;

  const hasMonths = costs && (data.costHandled.received.some(v => v > 0) || data.costHandled.issued.some(v => v > 0));
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="small text-muted">{costs ? <>Total stock value <strong className="text-dark">{peso(data.totalValue)}</strong></> : <>Total quantity <strong className="text-dark">{data.totalQty.toLocaleString()}</strong></>}</div>
        <div className="d-flex align-items-center gap-3">{onOpenTab && <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => onOpenTab('stock')}>View stock <i className="bi bi-arrow-right"></i></button>}<RefreshButton onClick={reload} loading={refreshing} /></div>
      </div>
      <div className="row g-3">
        <ChartCard title={costs ? 'Stock value by inventory type' : 'Stock quantity by inventory type'} subtitle={costs ? 'Share of the current stock value' : 'Share of the current stock quantity'} empty={data.byType.length === 0}><MixChart groups={data.byType} byQty={!costs} /></ChartCard>
        <ChartCard title={costs ? 'Stock value by inventory category' : 'Stock quantity by inventory category'} subtitle={costs ? 'Share of the current stock value' : 'Share of the current stock quantity'} empty={data.byCategory.length === 0}><MixChart groups={data.byCategory} byQty={!costs} /></ChartCard>
        {costs && <ChartCard wide title="Cost handled per month" subtitle="Value that came in and went out, last 12 months of the current fiscal year" empty={!hasMonths}>
          <Bar
            data={{ labels: data.costHandled.labels, datasets: [
              { label: 'Received', data: data.costHandled.received, backgroundColor: '#2f6f3e' },
              { label: 'Issued', data: data.costHandled.issued, backgroundColor: '#94a3b8' }
            ] }}
            options={{ maintainAspectRatio: false, scales: { y: { ticks: { callback: v => peso(Number(v)) } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${peso(Number(c.raw))}` } } } }}
          />
        </ChartCard>}
        <ChartCard wide title="Stock age" subtitle={costs ? 'Value by how long the stock has been here' : 'Quantity by how long the stock has been here'} empty={data.stockAge.every(g => (costs ? g.value : g.qty) === 0)}>
          <Bar
            data={{ labels: data.stockAge.map(g => g.label), datasets: [{ label: costs ? 'Value' : 'Quantity', data: data.stockAge.map(g => (costs ? g.value : g.qty)), backgroundColor: '#5c9a6a' }] }}
            options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => (costs ? peso(Number(c.raw)) : Number(c.raw).toLocaleString()) } } }, scales: { y: { ticks: { callback: v => (costs ? peso(Number(v)) : Number(v).toLocaleString()) } } } }}
          />
        </ChartCard>
      </div>
      {data.meta.notes.map(n => <div key={n} className="small text-muted mt-2">{n}</div>)}
    </>
  );
};
