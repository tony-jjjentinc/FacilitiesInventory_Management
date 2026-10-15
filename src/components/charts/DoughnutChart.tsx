import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import './register';
import { PALETTE } from './theme';

interface Props {
  labels: string[];
  values: number[];
  /** one colour per slice (default: the shared palette) */
  colors?: string[];
  /** how a value reads in the tooltip ("Label: value"); without it Chart.js writes its own */
  format?: (n: number) => string;
  legend?: 'right' | 'bottom';
  /** white lines between the slices (the analytics look) */
  separated?: boolean;
}

/** A doughnut: slices of one total. */
export const DoughnutChart: React.FC<Props> = ({ labels, values, colors, format, legend = 'right', separated }) => (
  <Doughnut
    data={{ labels, datasets: [{ data: values, backgroundColor: colors || labels.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: separated ? 2 : 1, ...(separated ? { borderColor: '#ffffff' } : {}) }] }}
    options={{
      maintainAspectRatio: false,
      plugins: {
        legend: { position: legend, labels: { boxWidth: 12, font: { size: 11 } } },
        ...(format ? { tooltip: { callbacks: { label: c => `${c.label}: ${format(Number(c.raw))}` } } } : {})
      }
    }}
  />
);
