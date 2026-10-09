import React from 'react';

interface Props {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}

/** Plain card with the same header style as the other pages: bold title, small grey hint. */
export const StepCard: React.FC<Props> = ({ title, hint, actions, children, flush }) => (
  <div className="card shadow-sm border-0 mb-4">
    <div className="card-header bg-white py-3 border-0 d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
      <div>
        <h6 className="fw-bold text-dark mb-0">{title}</h6>
        {hint && <small className="text-secondary">{hint}</small>}
      </div>
      {actions}
    </div>
    <div className={flush ? '' : 'card-body pt-0'}>{children}</div>
  </div>
);
