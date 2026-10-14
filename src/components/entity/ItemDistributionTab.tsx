/**
 * @file ItemDistributionTab.tsx
 * @description Where every unit of an inventory item is: warehouse (by area), in custody, deployed to activities,
 * plus what was consumed and written off.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Loading } from '../Loading';
import { RefreshButton } from '../RefreshButton';
import type { ItemDistribution } from '../../types';
import { entityPath, peso, qty } from './entityPaths';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { useEntityData } from './useEntity';

ChartJS.register(ArcElement, Tooltip, Legend);
import { GhostDoughnut } from './charts';
const PALETTE = ['#184421', '#5c9a6a', '#93bf9d', '#64748b', '#cbd5e1'];

const Section: React.FC<{ title: string; empty: string; isEmpty: boolean; children: React.ReactNode }> = ({ title, empty, isEmpty, children }) => (
  <div className="col-12 col-xl-6">
    <div className="card border shadow-sm h-100 bg-white">
      <div className="card-header bg-white border-bottom fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>{title}</div>
      <div className="card-body p-0">{isEmpty ? <div className="text-muted small p-3">{empty}</div> : children}</div>
    </div>
  </div>
);

export const ItemDistributionTab: React.FC<{ itemId: string }> = ({ itemId }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<ItemDistribution>('getDistribution', 'ITEM', itemId);
  const costs = getAccess(getCurrentUser()).canSeeCosts;
  if (loading && !data) return <Loading label="Loading the distribution…" />;
  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  if (!data) return null;
  const total = data.destinations.reduce((s, d) => s + d.qty, 0);
  return (
    <>
      <div className="d-flex justify-content-end mb-2"><RefreshButton onClick={reload} loading={refreshing} /></div>
      <div className="row g-3">
        <div className="col-12">
          <div className="card border shadow-sm bg-white">
            <div className="card-body">
              <div className="row align-items-center g-3">
                <div className="col-md-5" style={{ height: '220px' }}>
                  {total === 0 ? <GhostDoughnut /> : (
                    <Doughnut
                      data={{ labels: data.destinations.map(d => d.label), datasets: [{ data: data.destinations.map(d => d.qty), backgroundColor: PALETTE, borderWidth: 1 }] }}
                      options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }}
                    />
                  )}
                </div>
                <div className="col-md-7">
                  <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-light"><tr><th>Destination</th><th className="text-end">Quantity</th>{costs && <th className="text-end">Value</th>}</tr></thead>
                    <tbody>{data.destinations.map(d => <tr key={d.label}><td>{d.label}</td><td className="text-end">{qty(d.qty)}</td>{costs && <td className="text-end">{peso(d.value)}</td>}</tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Section title="In the warehouse" isEmpty={data.warehouse.length === 0} empty="Nothing in a warehouse.">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="table-light"><tr><th className="ps-3">Warehouse · Area</th><th className={`text-end${costs ? '' : ' pe-3'}`}>Quantity</th>{costs && <th className="text-end pe-3">Value</th>}</tr></thead>
            <tbody>{data.warehouse.map(w => <tr key={w.label}><td className="ps-3">{w.label}</td><td className={`text-end${costs ? '' : ' pe-3'}`}>{qty(w.qty)}</td>{costs && <td className="text-end pe-3">{peso(w.value)}</td>}</tr>)}</tbody>
          </table>
        </Section>
        {data.spots && data.spots.length > 0 && (
          <Section title="Where in the warehouse" isEmpty={false} empty="">
            <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead className="table-light"><tr><th className="ps-3">Area</th><th>Shelf · Level</th><th className="text-end pe-3">Quantity</th></tr></thead>
              <tbody>{data.spots.map((x, i) => <tr key={i}><td className="ps-3">{x.label}</td><td className={x.spotId ? '' : 'text-muted'}>{x.spot}</td><td className="text-end pe-3">{qty(x.qty)}</td></tr>)}</tbody>
            </table>
          </Section>
        )}
        <Section title="Deployed to activities" isEmpty={data.activities.length === 0} empty="Not deployed anywhere.">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="table-light"><tr><th className="ps-3">Activity</th><th className={`text-end${costs ? '' : ' pe-3'}`}>Quantity</th>{costs && <th className="text-end pe-3">Value</th>}</tr></thead>
            <tbody>{data.activities.map(a => <tr key={a.id}><td className="ps-3"><Link to={entityPath('ACTIVITY', a.id)} className="text-decoration-none">{a.label}</Link></td><td className={`text-end${costs ? '' : ' pe-3'}`}>{qty(a.qty)}</td>{costs && <td className="text-end pe-3">{peso(a.value)}</td>}</tr>)}</tbody>
          </table>
        </Section>
        <Section title="In custody" isEmpty={data.custody.length === 0} empty="Nobody holds this item.">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="table-light"><tr><th className="ps-3">Custodian</th><th>Sub-Department</th><th className="text-end pe-3">Quantity</th></tr></thead>
            <tbody>{data.custody.map((c, i) => <tr key={i}><td className="ps-3">{c.label || '–'}</td><td>{c.sub || '–'}</td><td className="text-end pe-3">{qty(c.qty)}</td></tr>)}</tbody>
          </table>
        </Section>
      </div>
      {data.meta.notes.map(n => <div key={n} className="small text-muted mt-2">{n}</div>)}
    </>
  );
};
