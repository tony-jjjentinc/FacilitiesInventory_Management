import React from 'react';
import { DataTable, type DataTableProps } from './DataTable';
import { RefreshButton } from './RefreshButton';
import { Tabs, type TabDef } from './TabBar';

export interface CardAction {
  key: string;
  label: string;
  /** bootstrap icon class, e.g. 'bi-plus-lg'. With an icon the label is hidden on small screens. */
  icon?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  hidden?: boolean;
  disabled?: boolean;
}

type Props<T> = Omit<DataTableProps<T>, 'actions'> & {
  title?: string;
  description?: string;
  actions?: CardAction[];
  onRefresh?: () => void;
  /** background loading: rows stay visible and the refresh button spins */
  refreshing?: boolean;
  tabs?: TabDef[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  /** extra content inside the table toolbar (right side) */
  toolbar?: React.ReactNode;
};

/** Card with a header (title, description, actions, refresh), optional tabs and a DataTable (search, filters, sort, paging). */
export function DataCard<T extends Record<string, any>>({
  title, description, actions, onRefresh, refreshing = false, tabs, activeTab, onTabChange, toolbar, ...table
}: Props<T>) {
  const visible = (actions || []).filter(a => !a.hidden);
  const hasHeader = title || description || visible.length > 0 || onRefresh;
  return (
    <div className="card border shadow-sm bg-white overflow-hidden">
      {hasHeader && (
        <div className="card-header bg-white py-3 px-3 px-md-4 border-bottom d-flex align-items-center justify-content-between gap-2">
          <div className="min-w-0">
            {title && <h5 className="fw-bold mb-0 text-dark">{title}</h5>}
            {description && <div className="small text-muted">{description}</div>}
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            {visible.map(a => (
              <button
                key={a.key}
                type="button"
                className={`btn btn-${a.variant || 'primary'} btn-sm d-inline-flex align-items-center justify-content-center gap-1`}
                style={{ height: '31px' }}
                onClick={a.onClick}
                disabled={a.disabled}
                title={a.label}
                aria-label={a.label}
              >
                {a.icon && <i className={`bi ${a.icon}`}></i>}
                <span className={a.icon ? 'd-none d-md-inline' : ''}>{a.label}</span>
              </button>
            ))}
            {onRefresh && <RefreshButton onClick={onRefresh} loading={refreshing || !!table.isLoading} />}
          </div>
        </div>
      )}
      {tabs && tabs.length > 1 && onTabChange && (
        <div className="px-3 px-md-4 pt-2">
          <Tabs tabs={tabs} active={activeTab || tabs[0].key} onChange={onTabChange} label={title || 'Sections'} />
        </div>
      )}
      <DataTable {...table} refreshing={refreshing} actions={toolbar} />
    </div>
  );
}
