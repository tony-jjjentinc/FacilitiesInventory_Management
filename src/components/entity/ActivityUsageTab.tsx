/**
 * @file ActivityUsageTab.tsx
 * @description Inventory stock usage of an activity: what was issued, returned and used up, per item.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { fetchWithSwr, invalidateCache } from '../../services/cache';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';
import type { ActivityInventoryItem } from '../../types';
import { entityPath, peso, qty } from './entityPaths';
import { getCurrentUser } from '../../services/auth';
import { getAccess, hideCosts } from '../../services/access';

const STATE: Record<string, string> = { DEPLOYED: 'Deployed', PARTIAL_USED: 'Partly used', EXPENDED: 'Used up', PARTIALLY_RETURNED: 'Partly returned', WRITTEN_OFF: 'Written off' };

export const ActivityUsageTab: React.FC<{ activityId: string }> = ({ activityId }) => {
  const [rows, setRows] = useState<ActivityInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = () => fetchWithSwr<ActivityInventoryItem[]>(`activity:items:${activityId}`, () => apiRequest('activity:getItems', { activityId }), d => { if (Array.isArray(d)) setRows(d); setLoading(false); })
    .catch(e => setError(e.message || 'Failed to load the usage.')).finally(() => { setLoading(false); setRefreshing(false); });
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => !q || `${r.Item_Name} ${r.Item_ID} ${r.Item_SKU}`.toLowerCase().includes(q));
  }, [rows, search]);

  const access = getAccess(getCurrentUser());
  const left = (r: ActivityInventoryItem) => (Number(r.Net_Used) || 0) - (Number(r.Qty_Expended) || 0);
  const net = (r: ActivityInventoryItem) => (Number(r.Net_Used) || 0) * (Number(r.Unit_Cost) || 0);
  const itemName = (r: ActivityInventoryItem) => <Link to={entityPath('ITEM', r.Item_ID)} className="fw-semibold text-dark text-decoration-none">{r.Item_Name}</Link>;
  const ids = (r: ActivityInventoryItem) => <div className="small text-muted font-monospace text-break">{r.Item_ID}{r.Item_SKU ? ` · ${r.Item_SKU}` : ''}</div>;
  const state = (r: ActivityInventoryItem) => <span className="badge bg-light text-muted border fw-normal">{STATE[String(r.Item_Tracking_State)] || '–'}</span>;

  // merged columns: returned sits under issued, what is left under used up, unit cost under the net value
  const columns: Column<ActivityInventoryItem>[] = [
    { key: 'Item_Name', label: 'Item', sortable: true, minWidth: '240px', render: r => <div>{itemName(r)}{ids(r)}</div> },
    { key: 'Qty_Issued', label: 'Issued', align: 'right', sortable: true, minWidth: '90px', render: r => <div><span className="fw-semibold text-dark">{qty(Number(r.Qty_Issued))}</span><div className="small text-muted">returned {qty(Number(r.Qty_Returned))}</div></div> },
    { key: 'Qty_Expended', label: 'Used up', align: 'right', sortable: true, minWidth: '100px', render: r => <div><span className="fw-semibold text-dark">{qty(Number(r.Qty_Expended))}</span><div className="small text-muted">left {qty(left(r))} {r.UOM}</div></div> },
    { key: 'value', label: 'Net value', align: 'right', minWidth: '120px', render: r => <div><div className="font-monospace fw-semibold text-dark small">{peso(net(r))}</div><div className="small text-muted font-monospace">@ {peso(Number(r.Unit_Cost))}</div></div> },
    { key: 'Item_Tracking_State', label: 'State', align: 'center', sortable: true, minWidth: '110px', render: state }
  ];
  const card = (r: ActivityInventoryItem) => (
    <div className="data-card">
      <div className="min-w-0">{itemName(r)}{ids(r)}</div>
      <div className="d-flex justify-content-between align-items-end gap-2">
        <div><span className="fs-5 fw-semibold text-dark">{qty(left(r))}</span> <span className="small text-muted">{r.UOM} left</span></div>
        {state(r)}
      </div>
      <div className="small text-muted">Issued {qty(Number(r.Qty_Issued))} · returned {qty(Number(r.Qty_Returned))} · used up {qty(Number(r.Qty_Expended))}</div>
      {access.canSeeCosts && <div className="data-card-foot small"><div className="font-monospace fw-semibold text-dark">{peso(net(r))}</div><div className="font-monospace text-muted">@ {peso(Number(r.Unit_Cost))}</div></div>}
    </div>
  );

  if (error && rows.length === 0) return <div className="alert alert-danger small">{error}</div>;
  return (
    <DataCard
      title="Inventory stock usage" description="What was issued to this activity, what came back and what was used up."
      columns={hideCosts(columns, access)} data={shown} renderCard={card} defaultView="cards" viewKey="entity-activity-usage" keyField="Activity_Line_ID" isLoading={loading && rows.length === 0}
      searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search by item, ID, SKU..."
      onRefresh={() => { invalidateCache(`activity:items:${activityId}`); setRefreshing(true); load(); }} refreshing={refreshing}
      emptyMessage="Nothing has been issued to this activity yet."
    />
  );
};
