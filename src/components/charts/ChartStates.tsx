import React from 'react';

/** A faded empty chart (axes and pale bars) with "No data available" over it: the empty version of a bar or line chart. */
export const GhostBars: React.FC<{ message?: string }> = ({ message = 'No data available' }) => (
  <div className="d-flex flex-column align-items-center justify-content-center h-100" role="img" aria-label={message}>
    <svg viewBox="0 0 200 110" width="240" height="132" aria-hidden="true">
      <line x1="20" y1="90" x2="190" y2="90" stroke="#e2e8f0" strokeWidth="1.5" />
      <line x1="20" y1="10" x2="20" y2="90" stroke="#e2e8f0" strokeWidth="1.5" />
      {[[34, 40], [62, 62], [90, 30], [118, 54], [146, 70]].map(([x, h]) => <rect key={x} x={x} y={90 - h} width="16" height={h} rx="2" fill="#f1f5f9" />)}
    </svg>
    <div className="small text-muted mt-1">{message}</div>
  </div>
);

/** A pulsing placeholder while a chart's data is on its way. */
export const ChartSkeleton: React.FC = () => (
  <div className="d-flex flex-column align-items-center justify-content-center h-100" role="status" aria-label="Loading the chart">
    <div className="kpi-skeleton" style={{ width: '60%', height: '60%', borderRadius: '0.5rem' }}></div>
    <div className="small text-muted mt-2">Loading…</div>
  </div>
);

/** What a chart says when it cannot be shown: what happened, and a way to try again. */
export const ChartMessage: React.FC<{ title: string; detail?: string; onRetry?: () => void }> = ({ title, detail, onRetry }) => (
  <div className="d-flex flex-column align-items-center justify-content-center text-center h-100 px-3" role="alert">
    <i className="bi bi-exclamation-triangle text-warning fs-4" aria-hidden="true"></i>
    <div className="fw-semibold small mt-1">{title}</div>
    {detail && <div className="small text-muted mt-1" style={{ maxWidth: '28rem' }}>{detail}</div>}
    {onRetry && <button type="button" className="btn btn-outline-secondary btn-sm mt-2" onClick={onRetry}>Try again</button>}
  </div>
);

interface BoundaryProps { children: React.ReactNode; onRetry?: () => void }
interface BoundaryState { error: Error | null }

/** Catches a chart that fails while drawing (bad data, a library error), so one chart never takes the whole page down. */
export class ChartBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BoundaryState { return { error }; }
  componentDidCatch(error: Error) { console.error('Chart failed to render:', error); }
  retry = () => { this.setState({ error: null }); this.props.onRetry?.(); };
  render() {
    if (this.state.error) return <ChartMessage title="Something went wrong drawing this chart" detail={this.state.error.message} onRetry={this.retry} />;
    return this.props.children;
  }
}
