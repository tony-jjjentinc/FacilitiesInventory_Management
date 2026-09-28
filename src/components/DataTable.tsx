import React, { useState, useMemo } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  minWidth?: string;
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | string;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  emptyMessage?: string;
  initialPageSize?: number;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  actions,
  emptyMessage = 'No records found.',
  initialPageSize = 10
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle column sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortDirection]);

  // Pagination calculation
  const totalEntries = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const pageData = sortedData.slice(startIndex, startIndex + pageSize);

  const getAlignmentClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-end';
    return 'text-start';
  };

  return (
    <div className="data-table-container">
      {/* Table Toolbar */}
      {(onSearchChange !== undefined || filters || actions) && (
        <div className="p-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
            {onSearchChange !== undefined && (
              <div className="input-group input-group-sm flex-grow-1" style={{ minWidth: '240px', maxWidth: '360px' }}>
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder={searchPlaceholder}
                  value={searchQuery || ''}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
            {filters}
          </div>

          {actions && <div>{actions}</div>}
        </div>
      )}

      {/* Table Body */}
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead>
            <tr>
              {columns.map((col) => {
                const alignClass = getAlignmentClass(col.align);
                return (
                  <th
                    key={col.key}
                    className={`${alignClass} ${col.sortable ? 'cursor-pointer user-select-none' : ''}`}
                    style={{
                      width: col.width,
                      minWidth: col.minWidth || '120px',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="ms-1 text-muted small">
                        {sortKey === col.key ? (
                          sortDirection === 'asc' ? <i className="bi bi-arrow-up"></i> : <i className="bi bi-arrow-down"></i>
                        ) : (
                          <i className="bi bi-arrow-down-up opacity-50"></i>
                        )}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4 text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((row, idx) => (
                <tr key={`${String(row[keyField] ?? 'row')}-${startIndex + idx}`}>
                  {columns.map((col) => {
                    const alignClass = getAlignmentClass(col.align);
                    return (
                      <td
                        key={col.key}
                        className={alignClass}
                        style={{
                          width: col.width,
                          minWidth: col.minWidth
                        }}
                      >
                        {col.render ? col.render(row, startIndex + idx) : (row[col.key] ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination & Footer */}
      <div className="px-3 py-2 border-top bg-light d-flex flex-wrap align-items-center justify-content-between gap-2 small text-muted">
        <div>
          Showing {totalEntries === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + pageSize, totalEntries)} of {totalEntries} entries
        </div>

        <div className="d-flex align-items-center gap-2">
          <label className="d-flex align-items-center gap-1 mb-0">
            <span>Per page:</span>
            <select
              className="form-select form-select-sm py-0"
              style={{ width: '70px', height: '28px' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-outline-secondary py-0"
              style={{ height: '28px' }}
              disabled={activePage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              title="Previous Page"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <span className="btn btn-outline-secondary disabled py-0 px-2" style={{ height: '28px' }}>
              {activePage} / {totalPages}
            </span>
            <button
              className="btn btn-outline-secondary py-0"
              style={{ height: '28px' }}
              disabled={activePage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              title="Next Page"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
