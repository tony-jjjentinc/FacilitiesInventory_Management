/**
 * @file ActivityOverviewTab.tsx
 * @description Activity overview: cost over time, type and category mix of what it holds, schedule and surplus return rate.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Loading } from '../Loading';
import { RefreshButton } from '../RefreshButton';
import type { ActivityOverview, ActivityUsage } from '../../types';
import { BarChart, ChartBoundary, ChartCard, COLOR, LineChart, MixChart } from '../charts';
import { entityPath, peso, qty } from './entityPaths';
import { useEntityData } from './useEntity';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { fmtDate } from '../../utils/datetime';

const days = (n: number | null) => (n === null ? 'TBD' : `${n} day${n === 1 ? '' : 's'}`);

/** What the activity has used, by inventory category: quantity (and cost) from the consumption log, with the tools and spare parts figures. */
const UsageByCategory: React.FC<{ usage: ActivityUsage; costs: boolean }> = ({ usage, costs }) => (
  <div className="col-12">
    <div className="card border shadow-sm bg-white">
      <div className="card-header bg-white border-bottom">
        <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Usage by inventory category</div>
        <div className="small text-muted" style={{ fontSize: '0.8rem' }}>What was consumed on this activity, from the consumption log</div>
      </div>
      <div className="card-body">
        <div className="row g-3 text-center mb-3">
          {costs && <div className="col-4"><div className="text-muted small">Cost consumed</div><div className="fw-bold">{peso(usage.consumedCost || 0)}</div></div>}
          <div className={costs ? 'col-4' : 'col-6'}><div className="text-muted small">Tools allocated</div><div className="fw-bold">{qty(usage.toolsQty)}</div></div>
          <div className={costs ? 'col-4' : 'col-6'}><div className="text-muted small">Spare parts used</div><div className="fw-bold">{qty(usage.sparesQty)}{costs && <span className="text-muted fw-normal small"> · {peso(usage.sparesCost || 0)}</span>}</div></div>
        </div>
        {usage.byCategory.length === 0 ? <div className="text-center text-muted small py-3">Nothing consumed yet.</div> : (
          <div className="row g-3 align-items-center">
            <div className="col-md-6" style={{ height: '220px' }}>
              <ChartBoundary><BarChart horizontal labels={usage.byCategory.map(c => c.label)} legend={false} lightGrid thickness={18} format={costs ? peso : qty}
                series={[{ label: costs ? 'Cost consumed' : 'Quantity consumed', data: usage.byCategory.map(c => costs ? (c.cost || 0) : c.qty), color: COLOR.strong }]} /></ChartBoundary>
            </div>
            <div className="col-md-6">
              <table className="table table-sm align-middle mb-0 table-stack" style={{ fontSize: '0.85rem' }}>
                <thead className="table-light"><tr><th>Inventory category</th><th className="text-end">Quantity</th>{costs && <th className="text-end">Cost</th>}</tr></thead>
                <tbody>{usage.byCategory.map(c => <tr key={c.label}><td data-label="Inventory category">{c.label}</td><td className="text-end" data-label="Quantity">{qty(c.qty)}</td>{costs && <td className="text-end" data-label="Cost">{peso(c.cost || 0)}</td>}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

export const ActivityOverviewTab: React.FC<{ activityId: string; onOpenTab?: (key: string) => void }> = ({ activityId, onOpenTab }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<ActivityOverview>('getOverview', 'ACTIVITY', activityId);
  const costs = getAccess(getCurrentUser()).canSeeCosts;
  if (loading && !data) return <Loading label="Loading the overview…" />;
  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  if (!data) return null;
  const s = data.schedule;
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="small text-muted">
          Planned <strong className="text-dark">{days(s.plannedDays)}</strong>
          {' · '}{s.completedAt ? 'Took' : 'Running'} <strong className={s.overdue ? 'text-danger' : 'text-dark'}>{days(s.actualDays)}</strong>{s.overdue && <span className="text-danger"> (past the target end)</span>}
          {' · '}Surplus returned <strong className="text-dark">{data.returns.rate === null ? '–' : `${data.returns.rate}%`}</strong>
          {data.subDepartments.length > 0 && <> {' · '}Sub-Departments {data.subDepartments.map((d, i) => <span key={d}>{i > 0 && ', '}<Link to={entityPath('SUBDEPARTMENT', d)} className="text-decoration-none">{d}</Link></span>)}</>}
        </div>
        <div className="d-flex align-items-center gap-3">{onOpenTab && <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => onOpenTab('usage')}>View stock usage <i className="bi bi-arrow-right"></i></button>}<RefreshButton onClick={reload} loading={refreshing} /></div>
      </div>
      <div className="row g-3">
        <UsageByCategory usage={data.usage} costs={costs} />
        {costs && <ChartCard wide title="Cost over time" subtitle={`Cumulative net cost of the items issued${s.targetEnd ? `, target end ${fmtDate(s.targetEnd)}` : ''}`} empty={data.burn.cumulative.length === 0}>
          <LineChart labels={data.burn.labels} format={peso} stepped series={[{ label: 'Net cost', data: data.burn.cumulative, color: COLOR.strong }]} />
        </ChartCard>}
        <ChartCard pie title="Inventory type" subtitle={costs ? 'Share of the net cost by type' : 'Share of the quantity by type'} empty={data.byType.length === 0}><MixChart groups={data.byType} byQty={!costs} /></ChartCard>
        <ChartCard pie title="Inventory category" subtitle={costs ? 'Share of the net cost by category' : 'Share of the quantity by category'} empty={data.byCategory.length === 0}><MixChart groups={data.byCategory} byQty={!costs} /></ChartCard>
      </div>
      {data.meta.notes.map(n => <div key={n} className="small text-muted mt-2">{n}</div>)}
    </>
  );
};
