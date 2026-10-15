import React from 'react';
import { Bar } from 'react-chartjs-2';
import './register';
import { COLOR } from './theme';

export interface ChartSeries { label: string; data: number[]; color: string }

interface Props {
  labels: string[];
  series: ChartSeries[];
  /** how a value reads in the tooltip and on the value axis; without it Chart.js writes plain numbers */
  format?: (n: number) => string;
  /** axis ticks, when they read shorter than the tooltip (₱12k) */
  tickFormat?: (n: number) => string;
  stacked?: boolean;
  /** bars grow to the right, one row per label */
  horizontal?: boolean;
  /** where the legend sits: default Chart.js (top), at the bottom, or none (one series needs no legend) */
  legend?: 'bottom' | false;
  /** light grid lines and no grid on the label axis (the analytics look) */
  lightGrid?: boolean;
  /** thin rounded bars: the widest a bar may get, in px */
  thickness?: number;
}

/** A bar chart: one or more series over the same labels. Tooltips say "Series: value" when there is more than one series. */
export const BarChart: React.FC<Props> = ({ labels, series, format, tickFormat, stacked, horizontal, legend, lightGrid, thickness }) => {
  const tick = tickFormat || format;
  const prefix = series.length > 1;
  const valueAxis = {
    ...(stacked ? { stacked: true } : {}),
    ...(lightGrid ? { grid: { color: COLOR.grid } } : {}),
    ...(tick ? { ticks: { callback: (v: string | number) => tick(Number(v)) } } : {})
  };
  const labelAxis = { ...(stacked ? { stacked: true } : {}), ...(lightGrid ? { grid: { display: false } } : {}) };
  return (
    <Bar
      data={{ labels, datasets: series.map(s => ({ label: s.label, data: s.data, backgroundColor: s.color, ...(thickness ? { borderRadius: 4, maxBarThickness: thickness } : {}) })) }}
      options={{
        maintainAspectRatio: false,
        ...(horizontal ? { indexAxis: 'y' as const } : {}),
        plugins: {
          ...(legend === false ? { legend: { display: false } } : legend === 'bottom' ? { legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } } } : {}),
          ...(format ? { tooltip: { callbacks: { label: c => `${prefix ? `${c.dataset.label}: ` : ''}${format(Number(c.raw))}` } } } : {})
        },
        scales: horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis }
      }}
    />
  );
};
