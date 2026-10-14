/**
 * @file MrtList.tsx
 * @description The list of material return vouchers (MRT) with their status.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { useToast } from '../../context/ToastContext';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';
import type { MrtRecord } from '../../types';
import { fmtDateTime } from '../../utils/datetime';


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
    { key: 'Return_Date', label: 'Date', sortable: true, minWidth: '130px', render: r => fmtDateTime(r.Return_Date) },
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
