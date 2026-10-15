import React from 'react';
import type { MixGroup } from '../../types';
import { peso } from '../../utils/format';
import { DoughnutChart } from './DoughnutChart';

/** A faded empty ring with "No data" in the middle, shown where a doughnut would be (same slot, so the layout does not jump). */
export const GhostDoughnut: React.FC = () => (
  <div className="d-flex flex-column align-items-center justify-content-center h-100" aria-label="No data">
    <svg viewBox="0 0 100 100" width="180" height="180" aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="none" stroke="#e2e8f0" strokeWidth="16" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="16" strokeDasharray="60 179" strokeDashoffset="-20" />
      <text x="50" y="54" textAnchor="middle" fontSize="9" fill="#94a3b8">No data</text>
    </svg>
  </div>
);

interface CardProps {
  title: string;
  subtitle: string;
  /** shows "No data" (or the ghost ring when `pie`) instead of the chart */
  empty: boolean;
  children: React.ReactNode;
  /** the full width of the row */
  wide?: boolean;
  /** this card holds a doughnut: the empty state is the ghost ring */
  pie?: boolean;
  /** three across on extra-large screens (the dashboard's pie row) instead of two */
  third?: boolean;
}

/** Card with an uppercase title and a fixed-height chart area. Two across on extra-large screens by default. */
export const ChartCard: React.FC<CardProps> = ({ title, subtitle, empty, children, wide, pie, third }) => (
  <div className={`col-12 ${wide ? '' : third ? 'col-xl-4' : 'col-xl-6'}`}>
    <div className="card border shadow-sm h-100 bg-white">
      <div className="card-header bg-white border-bottom">
        <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>{title}</div>
        <div className="small text-muted" style={{ fontSize: '0.8rem' }}>{subtitle}</div>
      </div>
      <div className="card-body">
        <div style={{ height: '260px' }} className={empty ? 'd-flex align-items-center justify-content-center text-muted small' : ''}>
          {empty ? (pie ? <GhostDoughnut /> : '–') : children}
        </div>
      </div>
    </div>
  </div>
);

/** Doughnut of a mix: peso values, or quantities for an account that may not see costs (`byQty`). */
export const MixChart: React.FC<{ groups: MixGroup[]; byQty?: boolean }> = ({ groups, byQty }) => {
  const values = groups.map(g => Number(byQty ? g.qty : g.value) || 0);
  if (!values.some(v => v > 0)) return <GhostDoughnut />; // no groups, or every group is 0 (stock with no price): a doughnut would draw nothing
  return <DoughnutChart labels={groups.map(g => g.label)} values={values} format={byQty ? (n => n.toLocaleString()) : peso} />;
};
