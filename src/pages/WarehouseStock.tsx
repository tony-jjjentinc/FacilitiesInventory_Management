import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import type { WarehouseStockItem } from '../types';
import { DataTable, type Column } from '../components/DataTable';

export const WarehouseStock: React.FC = () => {
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchStock = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock', {
        location: locationFilter
      });
      if (Array.isArray(data)) {
        setStock(data);
      }
    } catch (err) {
      console.error('Failed to load warehouse stock:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [locationFilter]);

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

  const columns: Column<WarehouseStockItem>[] = [
    {
      key: 'Inventory_ID',
      label: 'Inventory ID',
      align: 'left',
      minWidth: '160px',
      sortable: true,
      render: (row) => (
        <span className="font-monospace text-muted small">{row.Inventory_ID}</span>
      )
    },
    {
      key: 'Item_SKU',
      label: 'SKU & Name',
      align: 'left',
      minWidth: '240px',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-monospace fw-semibold text-dark me-2">{row.Item_SKU}</span>
          <span className="text-dark">{row.Item_Name}</span>
        </div>
      )
    },
    {
      key: 'Warehouse_Location',
      label: 'Location',
      align: 'left',
      minWidth: '140px',
      sortable: true,
      render: (row) => <span className="small text-muted">{row.Warehouse_Location}</span>
    },
    {
      key: 'Serial_Number',
      label: 'Serial Number',
      align: 'left',
      minWidth: '120px',
      render: (row) => <span className="font-monospace small text-muted">{row.Serial_Number || '—'}</span>
    },
    {
      key: 'Classification',
      label: 'Type',
      align: 'left',
      minWidth: '80px',
      sortable: true,
      render: (row) => <span className="small text-muted fw-medium">{row.Classification}</span>
    },
    {
      key: 'On_Hand_Qty',
      label: 'On-Hand Qty',
      align: 'right',
      minWidth: '110px',
      sortable: true,
      render: (row) => (
        <span className="fw-semibold text-dark">
          {row.On_Hand_Qty} <span className="fw-normal small text-muted">{row.UOM}</span>
        </span>
      )
    },
    {
      key: 'Unit_Cost',
      label: 'AVCO Unit Cost',
      align: 'right',
      minWidth: '120px',
      sortable: true,
      render: (row) => (
        <span className="font-monospace small">
          PHP {Number(row.Unit_Cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'Valuation',
      label: 'Valuation',
      align: 'right',
      minWidth: '130px',
      sortable: true,
      render: (row) => (
        <span className="font-monospace fw-semibold text-dark small">
          PHP {Number(row.Valuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'ROP_Status',
      label: 'ROP Status',
      align: 'center',
      minWidth: '110px',
      sortable: true,
      render: (row) => {
        if (row.ROP_Status === 'CRITICAL_DEPLETION') {
          return <span className="badge bg-danger-subtle text-danger border">Critical</span>;
        }
        if (row.ROP_Status === 'REORDER_WARNING') {
          return <span className="badge bg-warning-subtle text-warning-emphasis border">Warning</span>;
        }
        return <span className="badge bg-light text-muted border">Normal</span>;
      }
    }
  ];

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-2 border-bottom">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Warehouse Stock</h4>
          <p className="text-muted small mb-0">
            Real-time materialized on-hand balances, Moving Average Unit Cost (AVCO), and valuations.
          </p>
        </div>

        <button className="btn btn-outline-secondary btn-sm" onClick={fetchStock} disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredStock}
        keyField="Inventory_ID"
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
            <option value="FACILITIES_WAREHOUSE_MAIN">Main Warehouse</option>
            <option value="FACILITIES_WAREHOUSE_SUB_NORTH">North Sub-Warehouse</option>
          </select>
        }
      />
    </div>
  );
};
