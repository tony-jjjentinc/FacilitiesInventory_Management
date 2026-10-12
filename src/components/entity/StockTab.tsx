/**
 * @file StockTab.tsx
 * @description Inventory stock table for a warehouse, an area or an item (balances by scope).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';
import type { EntityScopeType, EntityStock, EntityStockRow } from '../../types';
import { entityPath, peso, qty } from './entityPaths';
import { useEntityData } from './useEntity';
import { getCurrentUser } from '../../services/auth';
import { getAccess, hideCosts } from '../../services/access';

interface Props { scopeType: EntityScopeType; scopeRef: string; showArea?: boolean }

const ROP: Record<string, string> = { NORMAL: 'Normal', REORDER_WARNING: 'Reorder soon', CRITICAL_DEPLETION: 'Critical' };

export const StockTab: React.FC<Props> = ({ scopeType, scopeRef, showArea = true }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<EntityStock>('getStock', scopeType, scopeRef);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || []).filter(r => !q || [r.name, r.itemId, r.sku, r.serialNumber, r.areaName].join(' ').toLowerCase().includes(q));
  }, [data, search]);

  const columns: Column<EntityStockRow>[] = [
    { key: 'name', label: 'Item Information', sortable: true, minWidth: '240px', render: r => (
      <div>
        {scopeType === 'ITEM' ? <span className="fw-semibold text-dark">{r.name}</span> : <Link to={entityPath('ITEM', r.itemId)} className="fw-semibold text-decoration-none">{r.name}</Link>}
        <div className="small text-muted">{r.itemId}{r.sku ? ` · ${r.sku}` : ''}</div>
      </div>
    ) },
    ...(showArea ? [{ key: 'areaName', label: 'Area', sortable: true, minWidth: '140px', render: (r: EntityStockRow) => r.areaId ? <Link to={entityPath('AREA', r.areaId)} className="text-decoration-none">{r.areaName || r.areaId}</Link> : 'No Data' }] : []),
    { key: 'serialNumber', label: 'Serial', minWidth: '110px', render: r => r.serialNumber && r.serialNumber !== 'N/A' ? r.serialNumber : 'No Data' },
    { key: 'onHand', label: 'On hand', align: 'right', sortable: true, minWidth: '100px', render: r => `${qty(r.onHand)} ${r.uom}` },
    { key: 'unitCost', label: 'Unit cost', align: 'right', sortable: true, minWidth: '100px', render: r => peso(r.unitCost) },
    { key: 'valuation', label: 'Value', align: 'right', sortable: true, minWidth: '110px', render: r => peso(r.valuation) },
    { key: 'ropStatus', label: 'Reorder', align: 'center', minWidth: '110px', render: r => ROP[r.ropStatus] || 'No Data' },
    { key: 'firstReceivedAt', label: 'Arrived', minWidth: '110px', render: r => r.firstReceivedAt ? r.firstReceivedAt.substring(0, 10) : 'No Data' }
  ];

  const access = getAccess(getCurrentUser());
  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  return (
    <DataCard
      title="Inventory stock"
      description={data ? `${data.totals.lines} line(s) · ${qty(data.totals.quantity)} units${access.canSeeCosts ? ` · ${peso(data.totals.value)}` : ''}` : undefined}
      columns={hideCosts(columns, access)} data={rows} keyField="inventoryId" isLoading={loading && !data}
      searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search by item, ID, SKU, serial..."
      onRefresh={reload} refreshing={refreshing} emptyMessage="No stock here."
    />
  );
};
