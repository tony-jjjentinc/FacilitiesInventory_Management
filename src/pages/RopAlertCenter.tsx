import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import type { WarehouseStockItem } from '../types';
import { DataTable, type Column } from '../components/DataTable';

import { fetchWithSwr, invalidateCache } from '../services/cache';

export const RopAlertCenter: React.FC = () => {
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [search, setSearch] = useState('');

  const fetchStock = async () => {
    try {
      await fetchWithSwr<WarehouseStockItem[]>(
        'inventory:stock:all',
        () => apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock'),
        (data) => {
          if (Array.isArray(data)) {
            setStock(data);
          }
        }
      );
    } catch (err) {
      console.error('Failed to load stock for ROP:', err);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const handleEvaluateRop = async () => {
    setIsEvaluating(true);
    try {
      const result = await apiRequest('rop:evaluate');
      setEvalResult(result);
      invalidateCache('inventory:stock');
      await fetchStock();
    } catch (err) {
      console.error('Failed to evaluate ROP:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const alertItems = stock.filter(
    item => item.ROP_Status === 'CRITICAL_DEPLETION' || item.ROP_Status === 'REORDER_WARNING'
  );

  const filteredAlerts = alertItems.filter(item => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.Item_Name?.toLowerCase().includes(q) ||
      item.Item_SKU?.toLowerCase().includes(q) ||
      item.Warehouse_Location?.toLowerCase().includes(q)
    );
  });

  const criticalCount = stock.filter(i => i.ROP_Status === 'CRITICAL_DEPLETION').length;
  const warningCount = stock.filter(i => i.ROP_Status === 'REORDER_WARNING').length;

  const columns: Column<WarehouseStockItem>[] = [
    {
      key: 'ROP_Status',
      label: 'Severity',
      align: 'center',
      minWidth: '120px',
      sortable: true,
      render: (row) => (
        <span
          className={`badge ${
            row.ROP_Status === 'CRITICAL_DEPLETION'
              ? 'bg-danger-subtle text-danger border'
              : 'bg-warning-subtle text-warning-emphasis border'
          }`}
        >
          {row.ROP_Status === 'CRITICAL_DEPLETION' ? 'Critical' : 'Warning'}
        </span>
      )
    },
    {
      key: 'Item_SKU',
      label: 'SKU & Item Name',
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
      key: 'On_Hand_Qty',
      label: 'Current On-Hand',
      align: 'right',
      minWidth: '120px',
      sortable: true,
      render: (row) => (
        <span className="fw-semibold text-danger">
          {row.On_Hand_Qty} <span className="small text-muted fw-normal">{row.UOM}</span>
        </span>
      )
    },
    {
      key: 'Unit_Cost',
      label: 'Unit Cost',
      align: 'right',
      minWidth: '110px',
      sortable: true,
      render: (row) => (
        <span className="font-monospace small">
          PHP {Number(row.Unit_Cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'Reorder_Qty',
      label: 'Recommended Reorder',
      align: 'right',
      minWidth: '140px',
      render: (row) => {
        const onHand = Number(row.On_Hand_Qty) || 0;
        const reorder = Math.max(20, onHand * 3 || 10);
        return (
          <span className="fw-semibold text-dark">
            +{reorder} <span className="small text-muted fw-normal">{row.UOM}</span>
          </span>
        );
      }
    },
    {
      key: 'Est_Cost',
      label: 'Estimated PO Cost',
      align: 'right',
      minWidth: '130px',
      render: (row) => {
        const onHand = Number(row.On_Hand_Qty) || 0;
        const reorder = Math.max(20, onHand * 3 || 10);
        const estCost = reorder * (Number(row.Unit_Cost) || 0);
        return (
          <span className="font-monospace small text-dark fw-semibold">
            PHP {estCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    }
  ];

  return (
    <div className="container py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Reorder Point (ROP) Alerts</h4>
          <p className="text-muted small mb-0">
            Stockout prediction based on 90-day consumption velocity, supplier lead time, and safety stock.
          </p>
        </div>

        <button
          className="btn btn-dark btn-sm"
          onClick={handleEvaluateRop}
          disabled={isEvaluating}
        >
          {isEvaluating ? 'Recalculating...' : 'Run ROP Evaluation'}
        </button>
      </div>

      {evalResult && (
        <div className="alert alert-secondary py-2 px-3 small d-flex justify-content-between align-items-center mb-4" role="alert">
          <div>
            Evaluation complete: {evalResult.itemsEvaluated} evaluated items • {evalResult.criticalCount} critical stockouts • {evalResult.warningCount} reorder warnings.
          </div>
          <button type="button" className="btn-close btn-sm" onClick={() => setEvalResult(null)}></button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <div className="card border shadow-sm p-3 bg-white">
            <div className="text-muted small text-uppercase fw-semibold mb-1">Critical Depletion (Safety Stock Breached)</div>
            <h4 className="fw-bold mb-1 text-danger">{criticalCount} items</h4>
            <div className="text-muted small">Immediate stockout risk for ongoing projects</div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="card border shadow-sm p-3 bg-white">
            <div className="text-muted small text-uppercase fw-semibold mb-1">Reorder Warnings (Lead Time Threshold)</div>
            <h4 className="fw-bold mb-1 text-warning">{warningCount} items</h4>
            <div className="text-muted small">Requisition drafting required within lead time window</div>
          </div>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredAlerts}
        keyField="Inventory_ID"
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter flagged items by SKU, name, or location..."
        emptyMessage="All consumable inventory levels are currently above reorder thresholds."
      />
    </div>
  );
};
