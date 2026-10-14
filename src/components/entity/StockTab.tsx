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
import { fmtDate } from '../../utils/datetime';

interface Props { scopeType: EntityScopeType; scopeRef: string; showArea?: boolean }

export const StockTab: React.FC<Props> = ({ scopeType, scopeRef, showArea = true }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<EntityStock>('getStock', scopeType, scopeRef);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || []).filter(r => !q || [r.name, r.itemId, r.sku, r.serialNumber, r.areaName].join(' ').toLowerCase().includes(q));
  }, [data, search]);

  const access = getAccess(getCurrentUser());
  const badge = (r: EntityStockRow) => r.ropStatus === 'CRITICAL_DEPLETION' ? <span className="badge bg-danger-subtle text-danger border">Critical</span>
    : r.ropStatus === 'REORDER_WARNING' ? <span className="badge bg-warning-subtle text-warning-emphasis border">Warning</span> : null;
  const day = (v?: string) => fmtDate(v);
  const itemName = (r: EntityStockRow) => scopeType === 'ITEM' ? <span className="fw-semibold text-dark">{r.name}</span> : <Link to={entityPath('ITEM', r.itemId)} className="fw-semibold text-dark text-decoration-none">{r.name}</Link>;
  const ids = (r: EntityStockRow) => <div className="small text-muted font-monospace text-break">{r.itemId}{r.sku ? ` · ${r.sku}` : ''}{r.serialNumber && r.serialNumber !== 'N/A' ? ` · S/N ${r.serialNumber}` : ''}</div>;
  const area = (r: EntityStockRow) => r.areaId ? <Link to={entityPath('AREA', r.areaId)} className="text-decoration-none">{r.areaName || r.areaId}</Link> : <span className="text-muted">–</span>;

  // merged columns: the item, its ids and serial share one cell; reorder status sits under the quantity; unit cost under the value
  const columns: Column<EntityStockRow>[] = [
    { key: 'name', label: 'Item', sortable: true, minWidth: '240px', render: r => <div>{itemName(r)}{ids(r)}</div> },
    ...(showArea ? [{ key: 'areaName', label: 'Area', sortable: true, minWidth: '130px', render: area }] : []),
    { key: 'onHand', label: 'On hand', align: 'right' as const, sortable: true, minWidth: '100px', render: r => <div><span className="fw-semibold text-dark">{qty(r.onHand)}</span> <span className="small text-muted">{r.uom}</span><div>{badge(r)}</div></div> },
    { key: 'valuation', label: 'Value', align: 'right' as const, sortable: true, minWidth: '130px', render: r => <div><div className="font-monospace fw-semibold text-dark small">{peso(r.valuation)}</div><div className="small text-muted font-monospace">@ {peso(r.unitCost)}</div></div> },
    { key: 'firstReceivedAt', label: 'Arrived', sortable: true, minWidth: '100px', render: r => <span className="small text-muted">{day(r.firstReceivedAt)}</span> }
  ];
  const card = (r: EntityStockRow) => (
    <div className="data-card">
      <div className="min-w-0">{itemName(r)}{ids(r)}</div>
      <div className="d-flex justify-content-between align-items-end gap-2">
        <div><span className="fs-5 fw-semibold text-dark">{qty(r.onHand)}</span> <span className="small text-muted">{r.uom}</span></div>
        {badge(r)}
      </div>
      {showArea && <span className="small">{area(r)}</span>}
      <div className="data-card-foot small text-muted">
        <div>{access.canSeeCosts && <><div className="font-monospace fw-semibold text-dark">{peso(r.valuation)}</div><div className="font-monospace">@ {peso(r.unitCost)}</div></>}</div>
        <div className="text-end">Arrived {day(r.firstReceivedAt)}</div>
      </div>
    </div>
  );

  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  return (
    <DataCard
      title="Inventory stock"
      description={data ? `${data.totals.lines} line(s) · ${qty(data.totals.quantity)} units${access.canSeeCosts ? ` · ${peso(data.totals.value)}` : ''}` : undefined}
      columns={hideCosts(columns, access)} data={rows} renderCard={card} defaultView="cards" viewKey={`entity-stock-${scopeType}`} keyField="inventoryId" isLoading={loading && !data}
      searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search by item, ID, SKU, serial..."
      onRefresh={reload} refreshing={refreshing} emptyMessage="No stock here."
    />
  );
};
