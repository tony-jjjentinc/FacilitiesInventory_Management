import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import { getCurrentUser, isUserHeadOrAdmin } from '../services/auth';
import type { WarehouseStockItem, LossIncident } from '../types';
interface DashboardOverviewProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [isEvaluatingRop, setIsEvaluatingRop] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);

  // Live Data States
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockItem[]>([]);
  const [pendingIncidents, setPendingIncidents] = useState<LossIncident[]>([]);

  useEffect(() => {
    // 1. Fetch live warehouse stock for KPIs and stock alerts
    fetchWithSwr(
      'inventory:stock:all',
      () => apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock'),
      (data) => {
        if (Array.isArray(data)) {
          setWarehouseStock(data);
        }
      }
    ).catch(err => console.warn('Dashboard stock fetch fallback:', err));

    // 2. Fetch pending incidents for the Pending Loss Approvals count (Head / Super Admin only)
    if (!isUserHeadOrAdmin(getCurrentUser())) return;
    fetchWithSwr(
      'incident:queue:PENDING_APPROVAL',
      () => apiRequest<LossIncident[]>('incident:getQueue', { status: 'PENDING_APPROVAL' }),
      (data) => {
        if (Array.isArray(data)) {
          setPendingIncidents(data);
        }
      }
    ).catch(err => console.warn('Dashboard incidents fetch fallback:', err));
  }, []);

  const goTo = (pathOrTab: string) => {
    const routeMap: Record<string, string> = {
      overview: '/overview',
      catalog: '/inventory?tab=catalog',
      warehouse: '/inventory',
      transactions: '/transactions?tab=ledger',
      receiving: '/transactions',
      alerts: '/inventory?tab=alerts',
      approvals: '/admin',
      config: '/configuration',
      configuration: '/configuration'
    };
    const target = routeMap[pathOrTab] || (pathOrTab.startsWith('/') ? pathOrTab : `/${pathOrTab}`);
    navigate(target);
    if (onNavigate) {
      onNavigate(pathOrTab);
    }
  };

  // Real live ROP evaluation trigger
  const handleTriggerRop = async () => {
    setIsEvaluatingRop(true);
    setEvaluationFeedback(null);
    try {
      const res = await apiRequest<{ itemsEvaluated?: number; evaluatedItemsCount?: number; criticalCount?: number; warningCount?: number }>('rop:evaluate');
      const count = res?.itemsEvaluated ?? res?.evaluatedItemsCount;
      const evalMsg = count != null
        ? `ROP evaluation complete: ${count} items evaluated (${res.criticalCount || 0} critical, ${res.warningCount || 0} warnings).`
        : 'ROP evaluation complete: reorder thresholds re-calculated across all active warehouses.';
      setEvaluationFeedback(evalMsg);
      // Invalidate stock caches and re-fetch stock data to reflect newly stamped ROP statuses
      invalidateCache('inventory:stock');
      fetchWithSwr(
        'inventory:stock:all',
        () => apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock'),
        (data) => {
          if (Array.isArray(data)) setWarehouseStock(data);
        }
      );
      setTimeout(() => setEvaluationFeedback(null), 8000);
    } catch (err: any) {
      alert(`ROP Evaluation failed: ${err.message}`);
    } finally {
      setIsEvaluatingRop(false);
    }
  };

  // Live KPI Calculations
  const totalValuation = warehouseStock.reduce(
    (acc, itm) => acc + (Number(itm.Valuation) || (Number(itm.On_Hand_Qty) * Number(itm.Unit_Cost)) || 0),
    0
  );

  const totalTrackedItems = warehouseStock.length;
  const criticalStockItems = warehouseStock.filter(itm => itm.ROP_Status === 'CRITICAL_DEPLETION');
  const warningStockItems = warehouseStock.filter(itm => itm.ROP_Status === 'REORDER_WARNING');
  const criticalCount = criticalStockItems.length;
  const warningCount = warningStockItems.length;
  const incidentsCount = pendingIncidents.length;

  return (
    <div className="container py-4 px-3 px-md-4">
      {/* ROP Feedback Banner */}
      {evaluationFeedback && (
        <div
          className="alert alert-success alert-dismissible fade show py-2 px-3 mb-4 d-flex align-items-center justify-content-between small shadow-sm"
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-check-circle-fill text-success"></i>
            <span>{evaluationFeedback}</span>
          </div>
          <button
            type="button"
            className="btn-close py-2"
            onClick={() => setEvaluationFeedback(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 2. Executive KPIs (6 Clickable Cards) */}
      {/* ------------------------------------------------------------------- */}
      <div className="row g-2 mb-4">
        {/* Total Stock Valuation -> Navigates to Warehouse */}
        <div className="col-6 col-lg-4 col-xxl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white cursor-pointer hover-shadow transition-all"
            onClick={() => goTo("warehouse")}
            role="button"
            tabIndex={0}
            title="View Warehouse Stock Valuation"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span
                className="text-muted small text-uppercase fw-semibold"
                style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}
              >
                Total Valuation
              </span>
              <i
                className="bi bi-cash-stack text-muted"
                style={{ fontSize: "1.25rem" }}
              ></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">
              PHP {(totalValuation / 1000000).toFixed(2)}M
            </h5>
          </div>
        </div>

        {/* Tracked Master SKUs -> Navigates to Catalog */}
        <div className="col-6 col-lg-4 col-xxl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white cursor-pointer hover-shadow transition-all"
            onClick={() => goTo("catalog")}
            role="button"
            tabIndex={0}
            title="View Inventory Catalog"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span
                className="text-muted small text-uppercase fw-semibold"
                style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}
              >
                Tracked Inventory
              </span>
              <i
                className="bi bi-tags text-muted"
                style={{ fontSize: "1.25rem" }}
              ></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">
              {totalTrackedItems} Items
            </h5>
          </div>
        </div>

        {/* Critical Stockouts -> Navigates to Alerts */}
        <div className="col-6 col-lg-4 col-xxl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white border-danger-subtle cursor-pointer hover-shadow transition-all"
            onClick={() => goTo("alerts")}
            role="button"
            tabIndex={0}
            title="View Critical Stockouts in ROP Alert Center"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span
                className="text-danger small text-uppercase fw-semibold"
                style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}
              >
                Critical Stockout
              </span>
              <i
                className="bi bi-exclamation-triangle-fill text-danger"
                style={{ fontSize: "1.25rem" }}
              ></i>
            </div>
            <h5 className="fw-bold mb-1 text-danger">{criticalCount} Items</h5>
          </div>
        </div>

        {/* Reorder Warnings -> Navigates to Alerts */}
        <div className="col-6 col-lg-4 col-xxl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white border-warning-subtle cursor-pointer hover-shadow transition-all"
            onClick={() => goTo("alerts")}
            role="button"
            tabIndex={0}
            title="View Reorder Warnings in ROP Alert Center"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span
                className="text-warning-emphasis small text-uppercase fw-semibold"
                style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}
              >
                Reorder Warnings
              </span>
              <i
                className="bi bi-exclamation-circle text-warning-emphasis"
                style={{ fontSize: "1.25rem" }}
              ></i>
            </div>
            <h5 className="fw-bold mb-1 text-warning-emphasis">
              {warningCount} Items
            </h5>
          </div>
        </div>

        {/* Pending Loss Approvals -> Navigates to Approvals */}
        <div className="col-6 col-lg-4 col-xxl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white cursor-pointer hover-shadow transition-all"
            onClick={() => goTo("approvals")}
            role="button"
            tabIndex={0}
            title="View Pending Incident Approvals"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span
                className="text-muted small text-uppercase fw-semibold"
                style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}
              >
                Incident Verification
              </span>
              <i
                className="bi bi-shield-exclamation text-warning"
                style={{ fontSize: "1.25rem" }}
              ></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">
              {incidentsCount} Incidents
            </h5>
          </div>
        </div>

        {/* In-House Custody Tools -> Navigates to Warehouse */}
        <div className="col-6 col-lg-4 col-xxl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white cursor-pointer hover-shadow transition-all"
            onClick={() => goTo("warehouse")}
            role="button"
            tabIndex={0}
            title="View In-House Custody and Assigned Assets"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span
                className="text-muted small text-uppercase fw-semibold"
                style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}
              >
                Custody Assets
              </span>
              <i
                className="bi bi-wrench-adjustable text-muted"
                style={{ fontSize: "1.25rem" }}
              ></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">42 Tools</h5>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Quick Actions & Deep Navigations */}
      {/* ------------------------------------------------------------------- */}
      <div className="card border shadow-sm mb-4 bg-white">
        <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between">
          <div>
            <span
              className="fw-semibold small text-uppercase text-muted"
              style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}
            >
              Quick Actions
            </span>
          </div>
        </div>
        <div className="card-body p-3">
          <div className="row g-2">
            {/* 1. Item Masterlist */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo("catalog")}
              >
                <div className="text-truncate">
                  <div
                    className="fw-semibold small text-truncate"
                    style={{ fontSize: "0.82rem" }}
                  >
                    Item Masterlist
                  </div>
                  <div
                    className="text-muted text-truncate"
                    style={{ fontSize: "0.7rem" }}
                  >
                    Catalog & Specs
                  </div>
                </div>
              </button>
            </div>

            {/* 2. Warehouse Stock */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo("warehouse")}
              >
                <div className="text-truncate">
                  <div
                    className="fw-semibold small text-truncate"
                    style={{ fontSize: "0.82rem" }}
                  >
                    Warehouse Stock
                  </div>
                  <div
                    className="text-muted text-truncate"
                    style={{ fontSize: "0.7rem" }}
                  >
                    Locations & Bins
                  </div>
                </div>
              </button>
            </div>

            {/* 3. ROP Stockout Alerts */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo("alerts")}
              >
                <div className="text-truncate">
                  <div
                    className="fw-semibold small text-truncate"
                    style={{ fontSize: "0.82rem" }}
                  >
                    Stockout Alerts
                  </div>
                  <div
                    className="text-secondary text-truncate"
                    style={{ fontSize: "0.7rem" }}
                  >
                    10 items reorder
                  </div>
                </div>
              </button>
            </div>

            {/* 4. Approvals Queue */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo("approvals")}
              >
                <div className="text-truncate">
                  <div
                    className="fw-semibold small text-truncate"
                    style={{ fontSize: "0.82rem" }}
                  >
                    Approvals Queue
                  </div>
                  <div
                    className="text-muted text-truncate"
                    style={{ fontSize: "0.7rem" }}
                  >
                    Incident sign-offs
                  </div>
                </div>
              </button>
            </div>

            {/* 5. Configuration */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo("config")}
              >
                <div className="text-truncate">
                  <div
                    className="fw-semibold small text-truncate"
                    style={{ fontSize: "0.82rem" }}
                  >
                    Configuration
                  </div>
                  <div
                    className="text-muted text-truncate"
                    style={{ fontSize: "0.7rem" }}
                  >
                    Master references
                  </div>
                </div>
              </button>
            </div>

            {/* 6. Evaluate ROP (Moved from Header) */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={handleTriggerRop}
                disabled={isEvaluatingRop}
                title="Run Reorder Point algorithms across all warehouses"
              >
                <div className="text-truncate">
                  <div
                    className="fw-semibold small text-truncate"
                    style={{ fontSize: "0.82rem" }}
                  >
                    {isEvaluatingRop ? "Checking..." : "Check Reorder Point"}
                  </div>
                  <div
                    className="text-muted text-truncate"
                    style={{ fontSize: "0.7rem" }}
                  >
                    Lead-time calculation
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
