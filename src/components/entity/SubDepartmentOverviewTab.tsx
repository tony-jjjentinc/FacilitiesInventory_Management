/**
 * @file SubDepartmentOverviewTab.tsx
 * @description Sub-department overview: cost per month (same figures as Analytics > Performance), the items it draws most,
 * tools that have not been used for a while, and loss incidents waiting for approval.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Loading } from '../Loading';
import { RefreshButton } from '../RefreshButton';
import type { SubDepartmentOverview } from '../../types';
import { ChartCard } from './charts';
import { entityPath, peso, qty } from './entityPaths';
import { useEntityData } from './useEntity';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';

export const SubDepartmentOverviewTab: React.FC<{ name: string; onOpenTab: (key: string) => void }> = ({ name, onOpenTab }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<SubDepartmentOverview>('getOverview', 'SUBDEPARTMENT', name);
  const costs = getAccess(getCurrentUser()).canSeeCosts;
  if (loading && !data) return <Loading label="Loading the overview…" />;
  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  if (!data) return null;
  const t = data.trend;
  const issued = costs ? t.issuedCost : t.issuedQty;
  const consumed = costs ? t.consumedCost : t.consumedQty;
  const hasCost = [...issued, ...consumed].some(v => v > 0);
  const fmt = (v: number) => (costs ? peso(v) : qty(v));
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="small">
          {data.pendingLoss > 0
            ? <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => onOpenTab('loss')}>{data.pendingLoss} loss incident(s) waiting for approval</button>
            : <span className="text-muted">No loss incidents waiting for approval</span>}
        </div>
        <RefreshButton onClick={reload} loading={refreshing} />
      </div>
      <div className="row g-3">
        <ChartCard wide title={costs ? 'Cost per month' : 'Quantity per month'} subtitle="Issued to activities and consumed, last 12 months" empty={!hasCost}>
          <Bar
            data={{ labels: t.labels, datasets: [
              { label: 'Issued', data: issued, backgroundColor: '#2f6f3e' },
              { label: 'Consumed', data: consumed, backgroundColor: '#94a3b8' }
            ] }}
            options={{ maintainAspectRatio: false, scales: { y: { ticks: { callback: v => fmt(Number(v)) } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(Number(c.raw))}` } } } }}
          />
        </ChartCard>
        <div className="col-12 col-xl-6">
          <div className="card border shadow-sm h-100 bg-white">
            <div className="card-header bg-white border-bottom fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Items drawn most <button type="button" className="btn btn-link btn-sm p-0 ms-2 align-baseline text-lowercase" onClick={() => onOpenTab('custody')}>view custody</button></div>
            {data.topItems.length === 0 ? <div className="text-muted small p-3">No Data</div> : (
              <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="table-light"><tr><th className="ps-3">Item</th><th className={`text-end${costs ? '' : ' pe-3'}`}>Quantity</th>{costs && <th className="text-end pe-3">Cost</th>}</tr></thead>
                <tbody>{data.topItems.map(i => <tr key={i.itemId}><td className="ps-3"><Link to={entityPath('ITEM', i.itemId)} className="text-decoration-none">{i.name || i.itemId}</Link></td><td className={`text-end${costs ? '' : ' pe-3'}`}>{qty(i.qty)}</td>{costs && <td className="text-end pe-3">{peso(i.value)}</td>}</tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
        <div className="col-12 col-xl-6">
          <div className="card border shadow-sm h-100 bg-white">
            <div className="card-header bg-white border-bottom">
              <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Tools not used for {data.idleDays} days <button type="button" className="btn btn-link btn-sm p-0 ms-2 align-baseline text-lowercase" onClick={() => onOpenTab('custody')}>view tools</button></div>
              <div className="small text-muted" style={{ fontSize: '0.75rem' }}>{data.idleCount} tool(s)</div>
            </div>
            {data.idleTools.length === 0 ? <div className="text-muted small p-3">None.</div> : (
              <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="table-light"><tr><th className="ps-3">Tool</th><th>Custodian</th><th className="text-end pe-3">Idle</th></tr></thead>
                <tbody>{data.idleTools.map((x, i) => <tr key={i}><td className="ps-3"><Link to={entityPath('ITEM', x.itemId)} className="text-decoration-none">{x.name || x.itemId}</Link></td><td>{x.custodian || '–'}</td><td className="text-end pe-3">{x.days} days{x.neverUsed ? ' (never used)' : ''}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {data.meta.notes.map(n => <div key={n} className="small text-muted mt-2">{n}</div>)}
    </>
  );
};
