import React, { useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { DataTable, type Column } from '../DataTable';
import type { StagedMrlSummary } from '../../types';
import { useMrlList } from './useMrlList';
import { simpleDate } from './receivingUtils';
import { Loading } from '../Loading';
import { toTimestamp, todayInputDate } from '../../utils/datetime';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (mrl: StagedMrlSummary) => void;
}

type Period = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';
const PERIODS: { value: Period; label: string; days: number }[] = [
  { value: 'TODAY', label: 'Today', days: 1 },
  { value: 'WEEK', label: 'Past week', days: 7 },
  { value: 'MONTH', label: 'Past month', days: 30 },
  { value: 'ALL', label: 'All', days: 0 }
];

type Row = StagedMrlSummary & { rowKey: string; releasedTs: number; classType: string };

/** Released MRLs that are not yet received: searchable, filterable and sortable. */
export const MrlPickerModal: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const { data, loadingAll, refreshing, error: listError, reload } = useMrlList(open);
  const [search, setSearch] = useState('');
  // opens on every MRL, so older ones are not hidden; the last range chosen is remembered in this browser
  const [period, setPeriodState] = useState<Period>(() => { try { const v = localStorage.getItem('jjjei_mrl_period'); return v === 'TODAY' || v === 'WEEK' || v === 'MONTH' || v === 'ALL' ? v : 'ALL'; } catch { return 'ALL'; } });
  const setPeriod = (v: Period) => { setPeriodState(v); try { localStorage.setItem('jjjei_mrl_period', v); } catch { /* not remembered */ } };
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
    return { ...m, rowKey: `${m.mrlNumber}|${m.mrqNumber}`, releasedTs: toTimestamp(m.releasedAt), classType: (m.classificationId.match(/^[A-Za-z]+/) || [''])[0].toUpperCase() };
  }), [data]);

  const classTypes = useMemo(() => Array.from(new Set(rows.map(r => r.classType).filter(Boolean))).sort(), [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r.batchNumber).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // a period of N days covers today and the N-1 days before it; MRLs with no readable release date only show under "All"
    const days = PERIODS.find(p => p.value === period)!.days;
    const cutoff = days > 0 ? toTimestamp(todayInputDate()) - (days - 1) * 86400000 : 0; // midnight today in Manila
    return rows.filter(r =>
      (days === 0 || (r.releasedTs > 0 && r.releasedTs >= cutoff)) &&
      (!classFilter || r.classType === classFilter) &&
      (!batchFilter || r.batchNumber === batchFilter) &&
      (!q || [r.mrlNumber, r.mrqNumber, r.projectName, r.classificationId, r.integr8GiNumber, r.location].join(' ').toLowerCase().includes(q))
    );
  }, [rows, search, period, classFilter, batchFilter]);

  const columns: Column<Row>[] = [
    { key: 'mrlNumber', label: 'MRL', sortable: true, minWidth: '90px', render: r => <span className="font-monospace fw-semibold text-dark">{r.mrlNumber}</span> },
    { key: 'mrqNumber', label: 'MRQ', sortable: true, minWidth: '90px', render: r => <span className="font-monospace">{r.mrqNumber}</span> },
    { key: 'projectName', label: 'Activity Title', sortable: true, minWidth: '220px', render: r => (<div>{r.projectName || '—'}<div className="small text-muted">{r.location}</div></div>) },
    { key: 'classificationId', label: 'Classification', sortable: true, minWidth: '120px', render: r => <span className="font-monospace small">{r.classificationId || '—'}</span> },
    { key: 'releasedTs', label: 'Released', sortable: true, minWidth: '130px', render: r => (<div>{simpleDate(r.releasedAt) || '—'}<div className="small text-muted">{r.batchNumber}</div></div>) },
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
            <div>
              <DataTable
              columns={columns}
              data={filtered}
              keyField="rowKey"
              searchQuery={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search"
              initialPageSize={10}
              isLoading={loadingAll && !data}
              refreshing={busy}
              emptyMessage={period === 'ALL' ? 'No MRLs available. Try "Sync from ProcInv".' : 'No MRLs released in this period. Choose a wider range, or try "Sync from ProcInv".'}
              filters={
                <>
                  <select className="form-select form-select-sm" style={{ width: '140px' }} aria-label="Filter by release date" value={period} onChange={e => setPeriod(e.target.value as Period)}>
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
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
                  {syncing ? <Loading variant="button" label="Syncing…" /> : 'Sync from ProcInv'}
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
