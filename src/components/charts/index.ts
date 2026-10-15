/**
 * The app's charts, in one place. Import from here:
 *   import { ChartCard, BarChart, LineChart, DoughnutChart, MixChart, KpiTile, PALETTE, COLOR } from '../components/charts';
 * Number formats live in utils/format.ts (peso, pesoWhole, pesoK, qty).
 */
import './register';

export { PALETTE, COLOR, HEALTH, SERIES, OTHERS } from './theme';
export { ChartCard, MixChart, GhostDoughnut } from './ChartCard';
export { ChartBoundary, ChartMessage, ChartSkeleton, GhostBars } from './ChartStates';
export { BarChart, type ChartSeries } from './BarChart';
export { LineChart } from './LineChart';
export { DoughnutChart } from './DoughnutChart';
export { KpiTile } from './KpiTile';
