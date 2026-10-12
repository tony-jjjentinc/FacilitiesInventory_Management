/**
 * @file MrqTracker.tsx
 * @description MRQ progress: for each material request, what was requested, released per batch, received, returned and is still open.
 * Also the list of material return vouchers (MRT) with their status.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { useToast } from '../../context/ToastContext';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';
import type { MrqItemProgress, MrqProgress, MrtRecord } from '../../types';

const qty = (v: number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 });

export const MrqTracker: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<MrqProgress[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('open');
  const load = useCallback(() => {
    setLoading(true);
    apiRequest<{ mrqs: MrqProgress[]; notes: string[] }>('receiving:getMrqProgress')
      .then(r => { setRows(r.mrqs || []); setNotes(r.notes || []); })
      .catch(e => toast.error(e.message || 'Could not load the request progress.')).finally(() => setLoading(false));
  }, [toast]);
  useEffect(load, [load]);

  const shown = rows.filter(r => (view === 'all' || !r.complete) && (!search.trim() || `${r.mrqNumber} ${r.project} ${r.requestedBy} ${r.department}`.toLowerCase().includes(search.trim().toLowerCase())));
  const columns: Column<MrqProgress>[] = [
    { key: 'mrqNumber', label: 'MRQ', sortable: true, minWidth: '90px' },
    { key: 'project', label: 'Project', minWidth: '220px', render: r => r.project || 'No Data' },
    { key: 'requestedBy', label: 'Requested by', minWidth: '130px', render: r => r.requestedBy || (r.department ? <>{r.department} <span className="text-muted small">(no specific person named)</span></> : '-') },
    { key: 'items', label: 'Items', align: 'right', minWidth: '60px', render: r => String(r.items.length) },
    { key: 'openItems', label: 'Still open', align: 'right', sortable: true, minWidth: '90px' },
    { key: 'complete', label: 'State', align: 'center', minWidth: '100px', render: r => (r.complete ? 'Complete' : 'Open') }
  ];
  const itemRows = (r: MrqProgress) => (
    <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
      <thead><tr><th>Item</th><th className="text-end">Requested</th><th>Released</th><th className="text-end">Received</th><th className="text-end">Returned</th><th className="text-end">To receive</th><th className="text-end">Not released</th><th>State</th></tr></thead>
      <tbody>
        {r.items.map((i: MrqItemProgress) => (
          <tr key={i.itemId || i.name}>
            <td>{i.name}</td><td className="text-end">{qty(i.requested)}</td>
            <td>{i.batches.length ? i.batches.map(b => `${b.batch || 'MRL'} ${b.mrlNumber}: ${qty(b.quantity)}`).join(' · ') : 'None yet'}</td>
            <td className="text-end">{qty(i.received)}</td><td className="text-end">{qty(i.returned)}</td><td className="text-end">{qty(i.open + i.waiting)}{i.waiting > 0 && <div className="text-muted small">{qty(i.waiting)} held by an open task</div>}</td><td className="text-end">{qty(i.notReleased)}</td><td>{i.state}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <DataCard<MrqProgress> title="Material requests" description="What was requested, released, received and returned for each request. Open ones first."
      tabs={[{ key: 'open', label: 'Open' }, { key: 'all', label: 'All' }]} activeTab={view} onTabChange={setView}
      columns={columns} data={shown} keyField="mrqNumber" isLoading={loading && rows.length === 0} searchQuery={search} onSearchChange={setSearch}
      searchPlaceholder="Search by MRQ, project, requester..." onRefresh={load} refreshing={loading} emptyMessage="No requests to show." renderExpanded={r => <div className="p-2">{itemRows(r)}{notes.map(n => <div key={n} className="small text-muted mt-1">{n}</div>)}</div>} />
  );
};

const STATUSES: [string, string][] = [['PENDING_PICKUP', 'Waiting for pickup'], ['RETURNED_TO_PROCINV', 'Returned to ProcInv'], ['ACKNOWLEDGED_BY_PROCINV', 'Acknowledged by ProcInv']];

export const MrtList: React.FC = () => {
  const toast = useToast();
  const access = getAccess(getCurrentUser());
  const [rows, setRows] = useState<MrtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    apiRequest<MrtRecord[]>('receiving:getMrts').then(r => setRows(Array.isArray(r) ? r : [])).catch(e => toast.error(e.message || 'Could not load the returns.')).finally(() => setLoading(false));
  }, [toast]);
  useEffect(load, [load]);
  const move = async (m: MrtRecord, status: string) => {
    try { await apiRequest('receiving:setMrtStatus', { mrtNumber: m.MRT_Number, status }); toast.success(`${m.MRT_Number} marked ${status.toLowerCase().replace(/_/g, ' ')}.`); load(); } catch (e: any) { toast.error(e.message || 'Could not update.'); }
  };
  const columns: Column<MrtRecord>[] = [
    { key: 'MRT_Number', label: 'MRT', sortable: true, minWidth: '120px' },
    { key: 'MRL_Number', label: 'MRL', sortable: true, minWidth: '80px' },
    { key: 'Return_Date', label: 'Date', sortable: true, minWidth: '130px', render: r => String(r.Return_Date).substring(0, 16) },
    { key: 'Return_Reason', label: 'Reason', minWidth: '180px', render: r => String(r.Return_Reason).replace(/_/g, ' ').toLowerCase() },
    { key: 'Total_Returned_Items', label: 'Lines', align: 'right', minWidth: '60px' },
    { key: 'Status', label: 'Status', minWidth: '200px', render: r => access.isCustodian
      ? <select className="form-select form-select-sm" aria-label="Status" value={r.Status} onChange={e => move(r, e.target.value)}>{STATUSES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      : (STATUSES.find(s => s[0] === r.Status)?.[1] || r.Status) }
  ];
  const shown = rows.filter(r => !search.trim() || `${r.MRT_Number} ${r.MRL_Number} ${r.MRQ_Number}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <DataCard<MrtRecord> title="Returns to ProcInv (MRT)" description="Items sent back at the dock. They never entered the stock."
      columns={columns} data={shown} keyField="MRT_Number" isLoading={loading && rows.length === 0} searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search by MRT, MRL, MRQ..."
      onRefresh={load} refreshing={loading} emptyMessage="No returns yet."
      renderExpanded={r => <div className="p-2"><table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}><thead><tr><th>Requested</th><th>Delivered</th><th className="text-end">Returned</th><th>Why</th></tr></thead><tbody>{r.items.map(i => <tr key={i.MRT_Line_ID}><td>{i.Requested_Item_Name}</td><td>{i.Delivered_Item_Name}</td><td className="text-end">{i.Quantity_Returned} {i.UOM}</td><td>{i.Mismatch_Details}</td></tr>)}</tbody></table></div>} />
  );
};
