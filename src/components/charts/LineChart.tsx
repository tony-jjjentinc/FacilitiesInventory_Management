import React from 'react';
import { Line } from 'react-chartjs-2';
import './register';
import type { ChartSeries } from './BarChart';

interface Props {
  labels: string[];
  series: ChartSeries[];
  /** how a value reads in the tooltip and on the value axis */
  format?: (n: number) => string;
  /** a step line (a running total that only changes when something is issued) instead of a smooth one */
  stepped?: boolean;
}

/** A line chart over the same labels; no legend (every use so far is a single line with a title above it). */
export const LineChart: React.FC<Props> = ({ labels, series, format, stepped }) => (
  <Line
    data={{ labels, datasets: series.map(s => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color, ...(stepped ? { stepped: true } : { tension: 0.2 }) })) }}
    options={{
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, ...(format ? { tooltip: { callbacks: { label: c => format(Number(c.raw)) } } } : {}) },
      ...(format ? { scales: { y: { ticks: { callback: (v: string | number) => format(Number(v)) } } } } : {})
    }}
  />
);
