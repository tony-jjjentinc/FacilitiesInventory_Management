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

  const columns: Column<ActivityInventoryItem>[] = [
    { key: 'Item_Name', label: 'Item Information', sortable: true, minWidth: '240px', render: r => (
      <div><Link to={entityPath('ITEM', r.Item_ID)} className="fw-semibold text-decoration-none">{r.Item_Name}</Link><div className="small text-muted">{r.Item_ID}{r.Item_SKU ? ` · ${r.Item_SKU}` : ''}</div></div>
    ) },
    { key: 'Qty_Issued', label: 'Issued', align: 'right', sortable: true, minWidth: '90px', render: r => qty(Number(r.Qty_Issued)) },
    { key: 'Qty_Returned', label: 'Returned', align: 'right', sortable: true, minWidth: '90px', render: r => qty(Number(r.Qty_Returned)) },
    { key: 'Qty_Expended', label: 'Used up', align: 'right', sortable: true, minWidth: '90px', render: r => qty(Number(r.Qty_Expended)) },
    { key: 'remaining', label: 'Left', align: 'right', minWidth: '90px', render: r => `${qty((Number(r.Net_Used) || 0) - (Number(r.Qty_Expended) || 0))} ${r.UOM}` },
    { key: 'Unit_Cost', label: 'Unit cost', align: 'right', sortable: true, minWidth: '100px', render: r => peso(Number(r.Unit_Cost)) },
    { key: 'value', label: 'Net value', align: 'right', minWidth: '110px', render: r => peso((Number(r.Net_Used) || 0) * (Number(r.Unit_Cost) || 0)) },
    { key: 'Item_Tracking_State', label: 'State', align: 'center', minWidth: '120px', render: r => STATE[String(r.Item_Tracking_State)] || 'No Data' }
  ];

  const access = getAccess(getCurrentUser());
  if (error && rows.length === 0) return <div className="alert alert-danger small">{error}</div>;
  return (
    <DataCard
      title="Inventory stock usage" description="What was issued to this activity, what came back and what was used up."
      columns={hideCosts(columns, access)} data={shown} keyField="Activity_Line_ID" isLoading={loading && rows.length === 0}
      searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search by item, ID, SKU..."
      onRefresh={() => { invalidateCache(`activity:items:${activityId}`); setRefreshing(true); load(); }} refreshing={refreshing}
      emptyMessage="Nothing has been issued to this activity yet."
    />
  );
};
