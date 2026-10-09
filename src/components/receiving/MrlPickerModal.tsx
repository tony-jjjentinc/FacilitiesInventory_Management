import React, { useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { DataTable, type Column } from '../DataTable';
import type { StagedMrlSummary } from '../../types';
import { useMrlList } from './useMrlList';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (mrl: StagedMrlSummary) => void;
}

type Row = StagedMrlSummary & { rowKey: string; releasedTs: number; classType: string };

/** Released MRLs that are not yet received: searchable, filterable and sortable. */
export const MrlPickerModal: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const { data, loadingAll, refreshing, error: listError, reload } = useMrlList(open);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const error = syncError || listError;
  const busy = loadingAll || refreshing || syncing;

  const sync = async () => {
    setSyncing(true);
    setSyncError('');
    try {
      await apiRequest('procurement:sync');
      await reload();
    } catch (err: any) {
      setSyncError(err.message || 'Sync from ProcInv failed.');
    } finally {
      setSyncing(false);
    }
  };

  const rows: Row[] = useMemo(() => (data?.mrls || []).map(m => {
    const ts = Date.parse(m.releasedAt);
    return { ...m, rowKey: `${m.mrlNumber}|${m.mrqNumber}`, releasedTs: isNaN(ts) ? 0 : ts, classType: (m.classificationId.match(/^[A-Za-z]+/) || [''])[0].toUpperCase() };
  }), [data]);

  const classTypes = useMemo(() => Array.from(new Set(rows.map(r => r.classType).filter(Boolean))).sort(), [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r.batchNumber).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (!classFilter || r.classType === classFilter) &&
      (!batchFilter || r.batchNumber === batchFilter) &&
      (!q || [r.mrlNumber, r.mrqNumber, r.projectName, r.classificationId, r.integr8GiNumber, r.location].join(' ').toLowerCase().includes(q))
    );
  }, [rows, search, classFilter, batchFilter]);

  const columns: Column<Row>[] = [
    { key: 'mrlNumber', label: 'MRL', sortable: true, minWidth: '90px', render: r => <span className="font-monospace fw-semibold text-dark">{r.mrlNumber}</span> },
    { key: 'mrqNumber', label: 'MRQ', sortable: true, minWidth: '90px', render: r => <span className="font-monospace">{r.mrqNumber}</span> },
    { key: 'projectName', label: 'Project', sortable: true, minWidth: '220px', render: r => (<div>{r.projectName || '—'}<div className="small text-muted">{r.location}</div></div>) },
    { key: 'classificationId', label: 'Classification', sortable: true, minWidth: '120px', render: r => <span className="font-monospace small">{r.classificationId || '—'}</span> },
    { key: 'releasedTs', label: 'Released', sortable: true, minWidth: '130px', render: r => (<div>{r.releasedAt || '—'}<div className="small text-muted">{r.batchNumber}</div></div>) },
    { key: 'lineCount', label: 'Lines', sortable: true, align: 'right', minWidth: '70px' },
    { key: 'totalQuantity', label: 'Quantity', sortable: true, align: 'right', minWidth: '90px' },
    { key: 'actions', label: '', align: 'right', minWidth: '90px', render: r => <button type="button" className="btn btn-primary btn-sm py-0" onClick={() => onSelect(r)}>Select</button> }
  ];

  if (!open) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">Select MRL</h6>
              <div className="text-muted small">
                Released MRLs that are not received yet. {data?.lastSyncedAt ? `Last synced ${data.lastSyncedAt}.` : 'Not synced yet.'}
                {data && data.pendingCount > 0 ? ` ${data.pendingCount} awaiting confirmation are hidden.` : ''}
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-0">
            {error && <div className={`alert ${data ? 'alert-warning' : 'alert-danger'} py-2 small m-3 mb-0`}>{error}</div>}
            {busy && (
              <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom small text-secondary" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm text-primary"></span>
                {syncing ? 'Syncing from ProcInv…' : loadingAll && !data ? 'Still loading MRLs…' : 'Updating the list…'}
              </div>
            )}
            <div>
              <DataTable
              columns={columns}
              data={filtered}
              keyField="rowKey"
              searchQuery={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search"
              initialPageSize={10}
              emptyMessage='No MRLs available. Try "Sync from ProcInv".'
              filters={
                <>
                  <select className="form-select form-select-sm" style={{ width: '150px' }} aria-label="Filter by classification type" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="">All classifications</option>
                    {classTypes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="form-select form-select-sm" style={{ width: '130px' }} aria-label="Filter by batch" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
                    <option value="">All batches</option>
                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </>
              }
              actions={
                <button type="button" className="btn btn-secondary btn-sm text-nowrap" onClick={sync} disabled={busy}>
                  {syncing ? 'Syncing…' : 'Sync from ProcInv'}
                </button>
              }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
