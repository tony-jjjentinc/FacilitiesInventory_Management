import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../services/api';
import type { WarehouseStockItem } from '../types';
import type { Column } from '../components/DataTable';
import { DataCard } from '../components/DataCard';
import { ActionMenu } from '../components/ActionMenu';
import { StockDetailModal } from '../components/StockDetailModal';
import { ItemTraceModal } from '../components/ItemTraceModal';

import { fetchWithSwr } from '../services/cache';
import { entityPath } from '../components/entity/entityPaths';
import { getCurrentUser } from '../services/auth';
import { getAccess, hideCosts } from '../services/access';
import { fmtDate } from '../utils/datetime';
import { UnpricedBanner } from '../components/UnpricedBanner';
import { peso } from '../utils/format';

export const WarehouseStock: React.FC = () => {
  const access = getAccess(getCurrentUser());
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [urlParams] = useSearchParams();
  const [locationFilter, setLocationFilter] = useState(urlParams.get('location') || ''); // ?location= comes from the general search
  // opening a search result while already on this page changes the URL without remounting
  useEffect(() => { const v = urlParams.get('location'); if (v !== null) setLocationFilter(v); }, [urlParams]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true); // the first fetch starts on mount: never flash 'No records found'
  const [detailRow, setDetailRow] = useState<WarehouseStockItem | null>(null);
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
      item.Serial_Number?.toLowerCase().includes(q) ||
      item.System?.toLowerCase().includes(q) ||
      item.Component?.toLowerCase().includes(q)
    );
  });

  const day = (v?: string) => fmtDate(v, '—');
  const ropBadge = (row: WarehouseStockItem) => row.ROP_Status === 'CRITICAL_DEPLETION'
    ? <span className="badge bg-danger-subtle text-danger border">Critical</span>
    : row.ROP_Status === 'REORDER_WARNING' ? <span className="badge bg-warning-subtle text-warning-emphasis border">Warning</span> : null; // Normal shows nothing
  const itemName = (row: WarehouseStockItem) => <Link to={entityPath('ITEM', row.Item_ID)} className="text-dark fw-semibold text-decoration-none">{row.Item_Name}</Link>;
  const skuLine = (row: WarehouseStockItem) => (
    <div className="small text-muted"><span className="font-monospace">{row.Item_SKU}</span>{row.Classification && <span className="badge bg-light text-muted border ms-1">{row.Classification}</span>}</div>
  );
  const where = (row: WarehouseStockItem) => (
    <div className="small"><Link to={entityPath('WAREHOUSE', row.Warehouse_Location)} className="text-decoration-none">{row.Warehouse_Name || row.Warehouse_Location}</Link>
      {row.Area_ID ? <div className="text-muted"><Link to={entityPath('AREA', row.Area_ID)} className="text-decoration-none text-muted">{row.Area_Name || row.Area_ID}</Link></div> : null}</div>
  );
  const purpose = (row: WarehouseStockItem) => (row.System || row.Component)
    ? <div className="small"><div className="text-dark">{row.System || '—'}</div>{row.Component && <div className="text-muted">{row.Component}</div>}</div>
    : <span className="small text-muted">—</span>;
  const menu = (row: WarehouseStockItem) => <ActionMenu actions={[
    { key: 'details', label: 'Details', hint: 'Everything about this stock line', onClick: () => setDetailRow(row) },
    { key: 'trace', label: 'View trace', hint: 'Who holds it, where it is, and its recent movements', onClick: () => setTraceRow(row) }
  ]} />;

  // Table: item | system and component | location | on hand | value | movement | menu (the stock line id and serial live in Details)
  const columns: Column<WarehouseStockItem>[] = [
    { key: 'Item_Name', label: 'Item', align: 'left', minWidth: '240px', sortable: true, render: (row) => <div>{itemName(row)}{skuLine(row)}</div> },
    { key: 'System', label: 'System / Component', align: 'left', minWidth: '180px', sortable: true, render: purpose },
    { key: 'Warehouse_Name', label: 'Location', align: 'left', minWidth: '150px', sortable: true, render: where },
    {
      key: 'On_Hand_Qty', label: 'On hand', align: 'right', minWidth: '110px', sortable: true,
      render: (row) => <div><span className="fw-semibold text-dark">{row.On_Hand_Qty}</span> <span className="small text-muted">{row.UOM}</span><div>{ropBadge(row)}</div></div>
    },
    {
      key: 'Valuation', label: 'Value', align: 'right', minWidth: '130px', sortable: true,
      render: (row) => <div><div className="font-monospace fw-semibold text-dark small">{peso(row.Valuation)}</div><div className="small text-muted font-monospace">@ {peso(row.Unit_Cost)}</div></div>
    },
    {
      key: 'First_Received_At', label: 'Movement', align: 'left', minWidth: '140px', sortable: true,
      render: (row) => <div className="small text-muted"><div>In: {day(row.First_Received_At)}</div><div>Out: {day(row.Last_Issued_At)}</div></div>
    },
    { key: 'actions', label: '', align: 'center', minWidth: '50px', render: (row) => <div className="d-flex justify-content-center">{menu(row)}</div> }
  ];

  // Card: the headline only (what, how many, where). Everything else is in the detail modal.
  const card = (row: WarehouseStockItem) => (
    <div className="data-card" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setDetailRow(row)} onKeyDown={e => { if (e.key === 'Enter') setDetailRow(row); }}>
      <div className="fw-semibold text-dark">{row.Item_Name}</div>
      <div className="small text-muted text-truncate">{row.Item_SKU}{row.Classification ? ` · ${row.Classification}` : ''}</div>
      {(row.System || row.Component) && <div className="small text-secondary text-truncate"><i className="bi bi-diagram-3 me-1"></i>{[row.System, row.Component].filter(Boolean).join(' · ')}</div>}
      <div className="d-flex justify-content-between align-items-center gap-2 py-1">
        <div><span className="fs-4 fw-semibold text-dark lh-1">{row.On_Hand_Qty}</span> <span className="small text-muted">{row.UOM}</span></div>
        {ropBadge(row)}
      </div>
      <div className="small text-muted text-truncate"><i className="bi bi-geo-alt me-1"></i>{[row.Warehouse_Name || row.Warehouse_Location, row.Area_Name || row.Area_ID].filter(Boolean).join(' · ')}</div>
    </div>
  );

  return (
    <div className="container py-4 px-3 px-md-4">
      <UnpricedBanner stock={stock} />
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
            {Array.from(new Map(stock.filter(s => s.Warehouse_Location).map(s => [s.Warehouse_Location, s.Warehouse_Name || s.Warehouse_Location]))).sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        }
      />
      {detailRow && <StockDetailModal row={detailRow} showCosts={access.canSeeCosts} onTrace={() => setTraceRow(detailRow)} onClose={() => setDetailRow(null)} />}
      {traceRow && <ItemTraceModal itemId={traceRow.Item_ID} serialNumber={traceRow.Serial_Number} onClose={() => setTraceRow(null)} />}
    </div>
  );
};
