/**
 * @file ActivityOverviewTab.tsx
 * @description Activity overview: cost over time, type and category mix of what it holds, schedule and surplus return rate.
 */
import React from 'react';
import { Line } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { Loading } from '../Loading';
import { RefreshButton } from '../RefreshButton';
import type { ActivityOverview } from '../../types';
import { ChartCard, MixChart } from './charts';
import { entityPath, peso } from './entityPaths';
import { useEntityData } from './useEntity';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';

const days = (n: number | null) => (n === null ? 'TBD' : `${n} day${n === 1 ? '' : 's'}`);

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
        {costs && <ChartCard wide title="Cost over time" subtitle={`Cumulative net cost of the items issued${s.targetEnd ? `, target end ${s.targetEnd}` : ''}`} empty={data.burn.cumulative.length === 0}>
          <Line
            data={{ labels: data.burn.labels, datasets: [{ label: 'Net cost', data: data.burn.cumulative, borderColor: '#184421', backgroundColor: '#184421', stepped: true }] }}
            options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => peso(Number(c.raw)) } } }, scales: { y: { ticks: { callback: v => peso(Number(v)) } } } }}
          />
        </ChartCard>}
        <ChartCard title="Inventory type" subtitle={costs ? 'Share of the net cost by type' : 'Share of the quantity by type'} empty={data.byType.length === 0}><MixChart groups={data.byType} byQty={!costs} /></ChartCard>
        <ChartCard title="Inventory category" subtitle={costs ? 'Share of the net cost by category' : 'Share of the quantity by category'} empty={data.byCategory.length === 0}><MixChart groups={data.byCategory} byQty={!costs} /></ChartCard>
      </div>
      {data.meta.notes.map(n => <div key={n} className="small text-muted mt-2">{n}</div>)}
    </>
  );
};
