import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../services/api';
import type { WarehouseStockItem } from '../types';
import type { Column } from '../components/DataTable';
import { DataCard } from '../components/DataCard';
import { ActionMenu } from '../components/ActionMenu';
import { ItemTraceModal } from '../components/ItemTraceModal';

import { fetchWithSwr } from '../services/cache';
import { entityPath } from '../components/entity/entityPaths';
import { getCurrentUser } from '../services/auth';
import { getAccess, hideCosts } from '../services/access';

export const WarehouseStock: React.FC = () => {
  const access = getAccess(getCurrentUser());
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [urlParams] = useSearchParams();
  const [locationFilter, setLocationFilter] = useState(urlParams.get('location') || ''); // ?location= comes from the general search
  // opening a search result while already on this page changes the URL without remounting
  useEffect(() => { const v = urlParams.get('location'); if (v !== null) setLocationFilter(v); }, [urlParams]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true); // the first fetch starts on mount: never flash 'No records found'
  const [traceRow, setTraceRow] = useState<WarehouseStockItem | null>(null);

  const fetchStock = useCallback(async () => {
    setIsLoading(true);
    const cacheKey = `inventory:stock:${locationFilter || 'all'}`;
    try {
      await fetchWithSwr<WarehouseStockItem[]>(
        cacheKey,
        () => apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock', {
          location: locationFilter
        }),
        (data, isInitialCache) => {
          if (Array.isArray(data)) {
            setStock(data);
          }
          if (isInitialCache) {
            setIsLoading(false);
          }
        }
      );
    } catch (err) {
      console.error('Failed to load warehouse stock:', err);
    } finally {
      setIsLoading(false);
    }
  }, [locationFilter]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const filteredStock = stock.filter(item => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.Item_Name?.toLowerCase().includes(q) ||
      item.Item_SKU?.toLowerCase().includes(q) ||
      item.Inventory_ID?.toLowerCase().includes(q) ||
      item.Serial_Number?.toLowerCase().includes(q)
    );
  });

  const peso = (n: unknown) => `PHP ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const day = (v?: string) => (v ? String(v).slice(0, 10) : '—');
  const ropBadge = (row: WarehouseStockItem) => row.ROP_Status === 'CRITICAL_DEPLETION'
    ? <span className="badge bg-danger-subtle text-danger border">Critical</span>
    : row.ROP_Status === 'REORDER_WARNING' ? <span className="badge bg-warning-subtle text-warning-emphasis border">Warning</span> : null; // Normal shows nothing
  const itemName = (row: WarehouseStockItem) => <Link to={entityPath('ITEM', row.Item_ID)} className="text-dark fw-semibold text-decoration-none">{row.Item_Name}</Link>;
  const skuLine = (row: WarehouseStockItem) => (
    <div className="small text-muted"><span className="font-monospace">{row.Item_SKU}</span>{row.Classification && <span className="badge bg-light text-muted border ms-1">{row.Classification}</span>}</div>
  );
  const idLine = (row: WarehouseStockItem) => <div className="small text-muted font-monospace text-break">{row.Inventory_ID}{row.Serial_Number ? ` · S/N ${row.Serial_Number}` : ''}</div>;
  const where = (row: WarehouseStockItem) => (
    <span className="small"><Link to={entityPath('WAREHOUSE', row.Warehouse_Location)} className="text-decoration-none">{row.Warehouse_Location}</Link>{row.Area_ID ? <> · <Link to={entityPath('AREA', row.Area_ID)} className="font-monospace text-decoration-none">{row.Area_ID}</Link></> : null}</span>
  );
  const menu = (row: WarehouseStockItem) => <ActionMenu actions={[{ key: 'trace', label: 'View trace', hint: 'Who holds it, where it is, and its recent movements', onClick: () => setTraceRow(row) }]} />;

  // 12 columns became 6 so the table fits a laptop screen; sorting keeps the merged column's main field
  const columns: Column<WarehouseStockItem>[] = [
    { key: 'Item_Name', label: 'Item', align: 'left', minWidth: '240px', sortable: true, render: (row) => <div>{itemName(row)}{skuLine(row)}{idLine(row)}</div> },
    { key: 'Warehouse_Location', label: 'Location', align: 'left', minWidth: '130px', sortable: true, render: where },
    {
      key: 'On_Hand_Qty', label: 'On hand', align: 'right', minWidth: '100px', sortable: true,
      render: (row) => <div><span className="fw-semibold text-dark">{row.On_Hand_Qty}</span> <span className="small text-muted">{row.UOM}</span><div>{ropBadge(row)}</div></div>
    },
    {
      key: 'Valuation', label: 'Value', align: 'right', minWidth: '130px', sortable: true,
      render: (row) => <div><div className="font-monospace fw-semibold text-dark small">{peso(row.Valuation)}</div><div className="small text-muted font-monospace">@ {peso(row.Unit_Cost)}</div></div>
    },
    {
      key: 'First_Received_At', label: 'Dates', align: 'left', minWidth: '120px', sortable: true,
      render: (row) => <div className="small text-muted"><div>In {day(row.First_Received_At)}</div><div>Out {day(row.Last_Issued_At)}</div></div>
    },
    { key: 'actions', label: '', align: 'center', minWidth: '50px', render: (row) => <div className="d-flex justify-content-center">{menu(row)}</div> }
  ];

  const card = (row: WarehouseStockItem) => (
    <div className="data-card">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div className="min-w-0">{itemName(row)}{skuLine(row)}</div>
        {menu(row)}
      </div>
      <div className="d-flex justify-content-between align-items-end gap-2">
        <div><span className="fs-5 fw-semibold text-dark">{row.On_Hand_Qty}</span> <span className="small text-muted">{row.UOM}</span></div>
        {ropBadge(row)}
      </div>
      {where(row)}
      {idLine(row)}
      <div className="data-card-foot small text-muted">
        <div>{access.canSeeCosts && <><div className="font-monospace fw-semibold text-dark">{peso(row.Valuation)}</div><div className="font-monospace">@ {peso(row.Unit_Cost)}</div></>}</div>
        <div className="text-end"><div>In {day(row.First_Received_At)}</div><div>Out {day(row.Last_Issued_At)}</div></div>
      </div>
    </div>
  );

  return (
    <div className="container py-4 px-3 px-md-4">
      <DataCard
        title="Warehouse Stock"
        description="Real-time materialized on-hand balances, Moving Average Unit Cost (AVCO), and valuations."
        onRefresh={fetchStock}
        refreshing={isLoading}
        isLoading={isLoading && stock.length === 0}
        columns={hideCosts(columns, access)}
        data={filteredStock}
        keyField="Inventory_ID"
        renderCard={card}
        defaultView="cards"
        viewKey="warehouse-stock"
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by SKU, name, inventory ID, or serial..."
        filters={
          <select
            className="form-select form-select-sm"
            style={{ width: '220px' }}
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">All Warehouse Locations</option>
            {Array.from(new Set(stock.map(s => s.Warehouse_Location).filter(Boolean))).sort().map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        }
      />
      {traceRow && <ItemTraceModal itemId={traceRow.Item_ID} serialNumber={traceRow.Serial_Number} onClose={() => setTraceRow(null)} />}
    </div>
  );
};
