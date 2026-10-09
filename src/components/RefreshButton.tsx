import React from 'react';

interface Props {
  onClick: () => void;
  loading?: boolean;
  title?: string;
}

/** Icon-only refresh button: light icon on solid secondary, spinner while loading. */
export const RefreshButton: React.FC<Props> = ({ onClick, loading = false, title = 'Refresh' }) => (
  <button
    type="button"
    className="btn btn-secondary btn-sm d-inline-flex align-items-center justify-content-center"
    style={{ width: '34px', height: '31px', padding: 0 }}
    onClick={onClick}
    disabled={loading}
    title={loading ? 'Refreshing…' : title}
    aria-label={title}
  >
    {loading
      ? <span className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></span>
      : <i className="bi bi-arrow-clockwise text-light"></i>}
  </button>
);
