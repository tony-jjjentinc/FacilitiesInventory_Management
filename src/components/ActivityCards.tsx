import React, { useMemo, useState } from 'react';
import type { ActivityRecord } from '../types';

interface Props {
  activities: ActivityRecord[];
  selectedId?: string;
  onSelect: (a: ActivityRecord) => void;
  loading?: boolean;
}

type SortKey = 'Activity_ID' | 'Activity_Name' | 'Current_Net_Cost' | 'Status' | 'Start_Date';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'Activity_ID', label: 'Activity ID' },
  { key: 'Activity_Name', label: 'Name' },
  { key: 'Current_Net_Cost', label: 'Net cost' },
  { key: 'Status', label: 'Status' },
  { key: 'Start_Date', label: 'Start date' }
];
const STATUSES = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PAGE = 12;

const badgeOf = (status?: string) => {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') return 'bg-success';
  if (s === 'ON_HOLD') return 'bg-warning text-dark';
  if (s === 'COMPLETED') return 'bg-primary';
  if (s === 'CANCELLED') return 'bg-danger';
  return 'bg-secondary';
};

const day = (v?: string) => (v ? String(v).slice(0, 10) : '—');

/** Activities as cards with search, status and type filters and sorting. Clicking a card selects it. */
export const ActivityCards: React.FC<Props> = ({ activities, selectedId, onSelect, loading }) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('Activity_ID');
  const [asc, setAsc] = useState(true);
  const [shown, setShown] = useState(PAGE);

  const types = useMemo(() => Array.from(new Set(activities.map(a => a.Activity_Type).filter(Boolean))).sort(), [activities]);

  const list = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = activities.filter(a =>
      (!status || (a.Status || '').toUpperCase() === status) &&
      (!type || a.Activity_Type === type) &&
      (!q || [a.Activity_ID, a.Activity_Name, a.Site_Location, a.Site_Supervisor_ID, a.Activity_Type].join(' ').toLowerCase().includes(q))
    );
    const dir = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === 'Current_Net_Cost') return ((Number(a.Current_Net_Cost) || 0) - (Number(b.Current_Net_Cost) || 0)) * dir;
      return String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [activities, search, status, type, sortKey, asc]);

  const visible = list.slice(0, shown);

  return (
    <div className="card border shadow-sm bg-white overflow-hidden mb-4">
      <div className="card-header bg-white py-3 px-3 px-md-4 border-bottom">
        <h5 className="fw-bold text-dark mb-0">Facilities Work Orders & Maintenance Projects</h5>
        <div className="small text-muted">Select an activity to inspect and manage the materials allocated to it.</div>
      </div>

      <div className="p-3 border-bottom d-flex flex-wrap align-items-center gap-2">
        <div className="input-group input-group-sm flex-grow-1" style={{ minWidth: '220px', maxWidth: '340px' }}>
          <span className="input-group-text bg-white border-end-0 text-muted"><i className="bi bi-search"></i></span>
          <input type="text" className="form-control border-start-0 ps-0" placeholder="Search activities" aria-label="Search activities"
            value={search} onChange={e => { setSearch(e.target.value); setShown(PAGE); }} />
        </div>
        <select className="form-select form-select-sm" style={{ width: '140px' }} aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value); setShown(PAGE); }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ width: '140px' }} aria-label="Filter by type" value={type} onChange={e => { setType(e.target.value); setShown(PAGE); }}>
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="d-flex gap-1 ms-md-auto">
          <select className="form-select form-select-sm" style={{ width: '140px' }} aria-label="Sort by" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
            {SORTS.map(s => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" style={{ width: '34px', padding: 0 }} onClick={() => setAsc(!asc)}
            title={asc ? 'Ascending' : 'Descending'} aria-label={asc ? 'Ascending' : 'Descending'}>
            <i className={`bi ${asc ? 'bi-sort-down-alt' : 'bi-sort-up'} text-light`}></i>
          </button>
        </div>
      </div>

      <div className="p-3 p-md-4">
        {loading && activities.length === 0 && (
          <div className="d-flex align-items-center gap-2 small text-secondary" role="status">
            <span className="spinner-border spinner-border-sm text-primary"></span> Loading activities…
          </div>
        )}
        {!loading && list.length === 0 && <div className="text-center text-muted py-4">No facilities activities found.</div>}
        <div className="row g-3">
          {visible.map(a => {
            const selected = a.Activity_ID === selectedId;
            return (
              <div key={a.Activity_ID} className="col-12 col-md-6 col-xl-4">
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  className={`card h-100 activity-card ${selected ? 'border-primary shadow' : 'border shadow-sm'}`}
                  style={{ cursor: 'pointer', borderWidth: selected ? '2px' : undefined }}
                  onClick={() => onSelect(a)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(a); } }}
                >
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <span className="font-monospace small text-primary">{a.Activity_ID}</span>
                      <span className={`badge ${badgeOf(a.Status)}`}>{a.Status}</span>
                    </div>
                    <div className="fw-medium text-dark mb-1">{a.Activity_Name}</div>
                    <div className="small text-secondary mb-3">{a.Site_Location || 'No Data'}</div>
                    <div className="d-flex justify-content-between align-items-end">
                      <div>
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>Net cost</div>
                        <div className="fw-bold text-dark">₱{(Number(a.Current_Net_Cost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      {a.Activity_Type && <span className="badge bg-secondary">{a.Activity_Type}</span>}
                    </div>
                  </div>
                  <div className="card-footer bg-white small text-muted d-flex justify-content-between gap-2">
                    <span className="text-truncate" title={a.Site_Supervisor_ID}>{a.Site_Supervisor_ID || 'No supervisor'}</span>
                    <span className="text-nowrap">{day(a.Start_Date)} → {a.Target_End_Date ? day(a.Target_End_Date) : 'TBD'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {list.length > shown && (
          <div className="text-center mt-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShown(shown + PAGE)}>
              Show more ({list.length - shown} left)
            </button>
          </div>
        )}
        {list.length > 0 && <div className="small text-muted mt-3">Showing {Math.min(shown, list.length)} of {list.length} activities</div>}
      </div>
    </div>
  );
};
