import React from 'react';

interface Props {
  label: string;
  /** the figure; null while it is still loading (a pulsing placeholder shows) */
  value: React.ReactNode | null;
  /** a quiet unit after the figure ("items", "incidents") */
  unit?: string;
  /** colour only when something needs attention */
  alert?: 'danger' | 'warning';
  state?: 'loading' | 'ready' | 'error';
  title?: string;
  onClick?: () => void;
}

/** One key figure: a label, one number and a quiet unit. A button when it has somewhere to go. */
export const KpiTile: React.FC<Props> = ({ label, value, unit, alert, state = 'ready', title, onClick }) => (
  <div
    className={`kpi-card h-100${alert ? ` kpi-${alert}` : ''}`}
    onClick={onClick}
    onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    title={title}
  >
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">
      {value === null
        ? <span className="kpi-skeleton" role="status" aria-label="Loading"></span>
        : <>{value}{state === 'ready' && unit && <span className="kpi-unit">{unit}</span>}</>}
    </div>
    {state === 'error' && <div className="kpi-unit ms-0">Couldn't load, use Refresh</div>}
  </div>
);
