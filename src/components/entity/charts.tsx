/**
 * @file charts.tsx
 * @description Chart pieces shared by the entity overview tabs: a titled card, a doughnut for a mix, the colour palette.
 * Chart.js elements are registered here once.
 */
import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, ArcElement } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { MixGroup } from '../../types';
import { peso } from './entityPaths';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, ArcElement);

export const PALETTE = ['#184421', '#2f6f3e', '#5c9a6a', '#93bf9d', '#c5ddca', '#64748b', '#94a3b8', '#cbd5e1'];

/** Card with an uppercase title and a fixed-height chart area; `empty` shows "No Data" instead of the chart. */
export const ChartCard: React.FC<{ title: string; subtitle: string; empty: boolean; children: React.ReactNode; wide?: boolean }> = ({ title, subtitle, empty, children, wide }) => (
  <div className={`col-12 ${wide ? '' : 'col-xl-6'}`}>
    <div className="card border shadow-sm h-100 bg-white">
      <div className="card-header bg-white border-bottom">
        <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>{title}</div>
        <div className="small text-muted" style={{ fontSize: '0.8rem' }}>{subtitle}</div>
      </div>
      <div className="card-body">
        <div style={{ height: '260px' }} className={empty ? 'd-flex align-items-center justify-content-center text-muted small' : ''}>
          {empty ? '–' : children}
        </div>
      </div>
    </div>
  </div>
);

/** Doughnut of a mix: peso values, or quantities for an account that may not see costs (`byQty`). */
export const MixChart: React.FC<{ groups: MixGroup[]; byQty?: boolean }> = ({ groups, byQty }) => (
  <Doughnut
    data={{ labels: groups.map(g => g.label), datasets: [{ data: groups.map(g => (byQty ? g.qty : g.value)), backgroundColor: groups.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 1 }] }}
    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: c => `${c.label}: ${byQty ? Number(c.raw).toLocaleString() : peso(Number(c.raw))}` } } } }}
  />
);
