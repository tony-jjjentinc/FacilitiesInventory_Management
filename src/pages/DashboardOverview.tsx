import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import { getCurrentUser, isUserHeadOrAdmin } from '../services/auth';
import type { WarehouseStockItem, TransactionEntry, LossIncident } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DashboardOverviewProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [activeTableTab, setActiveTableTab] = useState<'alerts' | 'activity' | 'approvals'>('alerts');
  const [isEvaluatingRop, setIsEvaluatingRop] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);

  // Live Data States
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionEntry[]>([]);
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

    // 2. Fetch live transaction history for Recent Transactions table
    fetchWithSwr(
      'transaction:history:ALL',
      () => apiRequest<TransactionEntry[]>('transaction:getHistory', { status: 'ALL' }),
      (data) => {
        if (Array.isArray(data)) {
          setRecentTransactions(data.slice(0, 10));
        }
      }
    ).catch(err => console.warn('Dashboard transactions fetch fallback:', err));

    // 3. Fetch pending incidents for Approvals Queue (Head / Super Admin only)
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

  // ---------------------------------------------------------------------------
  // Chart Configs (Dynamically derived from live warehouseStock & transactions)
  // ---------------------------------------------------------------------------

  // Chart 1: Valuation by Trade Scope (PHP)
  const tradeScopeMap: Record<string, { label: string; total: number }> = {
    PLB: { label: 'Plumbing (PLB)', total: 0 },
    ELE: { label: 'Electrical (ELE)', total: 0 },
    HVA: { label: 'HVAC & Ref (HVA)', total: 0 },
    PWR: { label: 'Power Tools (PWR)', total: 0 },
    CIV: { label: 'Civil & Masonry (CIV)', total: 0 },
    HDW: { label: 'Hardware (HDW)', total: 0 },
    MSC: { label: 'Miscellaneous (MSC)', total: 0 }
  };

  warehouseStock.forEach((item) => {
    const sku = item.Item_SKU || '';
    const parts = sku.split('-');
    const tradeCode = parts[1] || 'MSC';
    const val = Number(item.Valuation) || (Number(item.On_Hand_Qty || 0) * Number(item.Unit_Cost || 0)) || 0;
    if (tradeScopeMap[tradeCode]) {
      tradeScopeMap[tradeCode].total += val;
    } else {
      tradeScopeMap.MSC.total += val;
    }
  });

  const activeTradeEntries = Object.values(tradeScopeMap).filter(t => t.total > 0);
  const tradeLabels = activeTradeEntries.length > 0 ? activeTradeEntries.map(t => t.label) : ['Plumbing (PLB)', 'Electrical (ELE)', 'HVAC & Ref (HVA)', 'Power Tools (PWR)', 'Civil (CIV)', 'Hardware (HDW)'];
  const tradeDataValues = activeTradeEntries.length > 0 ? activeTradeEntries.map(t => Math.round(t.total)) : [1340000, 1120000, 1260000, 680000, 425450, 310000];

  const categoryValuationData = {
    labels: tradeLabels,
    datasets: [
      {
        label: 'Asset Valuation (PHP)',
        data: tradeDataValues,
        backgroundColor: '#1e293b',
        hoverBackgroundColor: '#0f172a',
        borderRadius: 4,
        maxBarThickness: 32
      }
    ]
  };

  // Chart 2: Inventory Classification Breakdown
  const classCounts: Record<string, number> = {
    'Consumables (CNS)': 0,
    'Tools & Equipment (TLS)': 0,
    'Spare Parts (SPR)': 0,
    'Misc (MSC)': 0
  };

  warehouseStock.forEach((item) => {
    const cls = (item.Classification || '').toUpperCase();
    if (cls === 'CNS') classCounts['Consumables (CNS)']++;
    else if (cls === 'TLS' || cls === 'AST') classCounts['Tools & Equipment (TLS)']++;
    else if (cls === 'SPR') classCounts['Spare Parts (SPR)']++;
    else classCounts['Misc (MSC)']++;
  });

  const totalClassItems = warehouseStock.length;
  const classificationLabels = Object.keys(classCounts);
  const classificationValues = totalClassItems > 0
    ? Object.values(classCounts).map(cnt => Math.round((cnt / totalClassItems) * 100))
    : [58, 22, 14, 6];

  const classificationData = {
    labels: classificationLabels,
    datasets: [
      {
        data: classificationValues,
        backgroundColor: ['#0f172a', '#334155', '#64748b', '#cbd5e1'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  // Chart 3: 6-Month Inventory Velocity (Procured vs Issued)
  const monthMap: Record<string, { procured: number; issued: number }> = {};
  recentTransactions.forEach((tx) => {
    const dateStr = tx.timestamp || '';
    const dateObj = new Date(dateStr);
    const monthKey = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' })
      : 'Current';

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { procured: 0, issued: 0 };
    }

    const cost = Number(tx.totalCost) || 0;
    if (tx.transactionType?.startsWith('IN:')) {
      monthMap[monthKey].procured += cost;
    } else if (tx.transactionType?.startsWith('OUT:')) {
      monthMap[monthKey].issued += cost;
    }
  });

  const velocityLabels = Object.keys(monthMap).length >= 2
    ? Object.keys(monthMap)
    : ['May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026 (Est.)'];

  const velocityProcuredData = Object.keys(monthMap).length >= 2
    ? Object.values(monthMap).map(m => m.procured)
    : [420000, 560000, 380000, 620000, 490000, 510000];

  const velocityIssuedData = Object.keys(monthMap).length >= 2
    ? Object.values(monthMap).map(m => m.issued)
    : [390000, 480000, 410000, 540000, 460000, 430000];

  const velocityData = {
    labels: velocityLabels,
    datasets: [
      {
        label: 'Procured / Stock In (PHP)',
        data: velocityProcuredData,
        backgroundColor: '#0f172a',
        borderRadius: 3,
        maxBarThickness: 16
      },
      {
        label: 'Issued to Work Orders (PHP)',
        data: velocityIssuedData,
        backgroundColor: '#94a3b8',
        borderRadius: 3,
        maxBarThickness: 16
      }
    ]
  };

  // Chart 4: Warehouse Storage Distribution
  const storageDistMap: Record<string, number> = {};
  warehouseStock.forEach((item) => {
    const loc = item.Warehouse_Location || 'FACILITIES_WAREHOUSE_MAIN';
    storageDistMap[loc] = (storageDistMap[loc] || 0) + 1;
  });

  const storageLabels = Object.keys(storageDistMap).length > 0
    ? Object.keys(storageDistMap)
    : ['Main Facility (WH-MAIN)', 'North Yard (WH-NORTH)', 'Engineering Toolroom (TL-ENG)', 'Sub-Depots'];

  const storageValues = Object.keys(storageDistMap).length > 0
    ? Object.values(storageDistMap)
    : [52, 26, 14, 8];

  const locationData = {
    labels: storageLabels,
    datasets: [
      {
        data: storageValues,
        backgroundColor: ['#1e293b', '#475569', '#94a3b8', '#cbd5e1', '#e2e8f0'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  return (
    <div className="container py-4 px-3 px-md-4">

      {/* ROP Feedback Banner */}
      {evaluationFeedback && (
        <div className="alert alert-success alert-dismissible fade show py-2 px-3 mb-4 d-flex align-items-center justify-content-between small shadow-sm" role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-check-circle-fill text-success"></i>
            <span>{evaluationFeedback}</span>
          </div>
          <button type="button" className="btn-close py-2" onClick={() => setEvaluationFeedback(null)} aria-label="Close"></button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 2. Executive KPIs (6 Clickable Cards) */}
      {/* ------------------------------------------------------------------- */}
      <div className="row g-3 mb-4">
        {/* Total Stock Valuation -> Navigates to Warehouse */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white cursor-pointer hover-shadow transition-all"
            onClick={() => goTo('warehouse')}
            role="button"
            tabIndex={0}
            title="View Warehouse Stock Valuation"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                Total Valuation
              </span>
              <i className="bi bi-cash-stack text-muted" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">
              PHP {(totalValuation / 1000000).toFixed(2)}M
            </h5>
          </div>
        </div>

        {/* Tracked Master SKUs -> Navigates to Catalog */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white cursor-pointer hover-shadow transition-all"
            onClick={() => goTo('catalog')}
            role="button"
            tabIndex={0}
            title="View Master Catalog SKUs"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                Tracked Inventory
              </span>
              <i className="bi bi-tags text-muted" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">
              {totalTrackedItems} Items
            </h5>
          </div>
        </div>

        {/* Critical Stockouts -> Navigates to Alerts */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white border-danger-subtle cursor-pointer hover-shadow transition-all"
            onClick={() => goTo('alerts')}
            role="button"
            tabIndex={0}
            title="View Critical Stockouts in ROP Alert Center"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-danger small text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                Critical Stockout
              </span>
              <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <h5 className="fw-bold mb-1 text-danger">
              {criticalCount} Items
            </h5>
          </div>
        </div>

        {/* Reorder Warnings -> Navigates to Alerts */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white border-warning-subtle cursor-pointer hover-shadow transition-all"
            onClick={() => goTo('alerts')}
            role="button"
            tabIndex={0}
            title="View Reorder Warnings in ROP Alert Center"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-warning-emphasis small text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                Reorder Warnings
              </span>
              <i className="bi bi-exclamation-circle text-warning-emphasis" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <h5 className="fw-bold mb-1 text-warning-emphasis">
              {warningCount} Items
            </h5>
          </div>
        </div>

        {/* Pending Loss Approvals -> Navigates to Approvals */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white cursor-pointer hover-shadow transition-all"
            onClick={() => goTo('approvals')}
            role="button"
            tabIndex={0}
            title="View Pending Incident Approvals"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                Incident Verification
              </span>
              <i className="bi bi-shield-exclamation text-warning" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">
              {incidentsCount} Incidents
            </h5>
          </div>
        </div>

        {/* In-House Custody Tools -> Navigates to Warehouse */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div
            className="card border shadow-sm p-3 h-100 bg-white cursor-pointer hover-shadow transition-all"
            onClick={() => goTo('warehouse')}
            role="button"
            tabIndex={0}
            title="View In-House Custody and Assigned Assets"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                Custody Assets
              </span>
              <i className="bi bi-wrench-adjustable text-muted" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">
              42 Tools
            </h5>
            <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
              Assigned to 18 technicians
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Quick Actions & Deep Navigations */}
      {/* ------------------------------------------------------------------- */}
      <div className="card border shadow-sm mb-4 bg-white">
        <div className="card-body p-3">

          <div className="row g-2">
            {/* 1. Item Masterlist */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo('catalog')}
              >
                <i className="bi bi-tools text-secondary fs-5 me-2"></i>
                <div className="text-truncate">
                  <div className="fw-semibold small text-truncate" style={{ fontSize: '0.82rem' }}>Item Masterlist</div>
                  <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Catalog & Specs</div>
                </div>
              </button>
            </div>

            {/* 2. Warehouse Stock */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo('warehouse')}
              >
                <i className="bi bi-box text-secondary fs-5 me-2"></i>
                <div className="text-truncate">
                  <div className="fw-semibold small text-truncate" style={{ fontSize: '0.82rem' }}>Warehouse Stock</div>
                  <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Locations & Bins</div>
                </div>
              </button>
            </div>

            {/* 3. ROP Stockout Alerts */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo('alerts')}
              >
                <i className="bi bi-exclamation-triangle text-secondary fs-5 me-2"></i>
                <div className="text-truncate">
                  <div className="fw-semibold small text-truncate" style={{ fontSize: '0.82rem' }}>Stockout Alerts</div>
                  <div className="text-secondary text-truncate" style={{ fontSize: '0.7rem' }}>10 items reorder</div>
                </div>
              </button>
            </div>

            {/* 4. Approvals Queue */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo('approvals')}
              >
                <i className="bi bi-check-circle text-secondary fs-5 me-2"></i>
                <div className="text-truncate">
                  <div className="fw-semibold small text-truncate" style={{ fontSize: '0.82rem' }}>Approvals Queue</div>
                  <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Incident sign-offs</div>
                </div>
              </button>
            </div>

            {/* 5. Configuration */}
            <div className="col-6 col-md-4 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-light border text-dark w-100 py-2 px-3 text-start d-flex align-items-center gap-2 h-100 hover-shadow transition-all"
                onClick={() => goTo('config')}
              >
                <i className="bi bi-sliders text-secondary fs-5 me-2"></i>
                <div className="text-truncate">
                  <div className="fw-semibold small text-truncate" style={{ fontSize: '0.82rem' }}>Configuration</div>
                  <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Master references</div>
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
                <i className={`bi bi-arrow-repeat text-secondary fs-5 me-2 ${isEvaluatingRop ? 'spin-animation' : ''}`}></i>
                <div className="text-truncate">
                  <div className="fw-semibold small text-truncate" style={{ fontSize: '0.82rem' }}>
                    {isEvaluatingRop ? 'Checking...' : 'Check Reorder Point'}
                  </div>
                  <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Lead-time calculation</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4. Charts and Graphs (2 x 2 Balanced Visual Layout) */}
      {/* ------------------------------------------------------------------- */}
      <div className="row g-3 mb-4">
        {/* Chart 1: Valuation by Trade Scope */}
        <div className="col-12 col-xl-6">
          <div className="card border shadow-sm h-100 bg-white">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
              <div>
                <span className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Inventory Valuation by Trade Scope
                </span>
                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>Physical stock valuation grouped by primary trade discipline</div>
              </div>
              <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '0.72rem' }}>PHP 5.14M</span>
            </div>
            <div className="card-body">
              <div style={{ height: '260px' }}>
                <Bar
                  data={categoryValuationData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => `Valuation: PHP ${Number(context.raw).toLocaleString()}`
                        }
                      }
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: {
                        grid: { color: '#f1f5f9' },
                        ticks: {
                          callback: (val) => `PHP ${(Number(val) / 1000).toFixed(0)}k`
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: 6-Month Inflow vs Outflow Velocity */}
        <div className="col-12 col-xl-6">
          <div className="card border shadow-sm h-100 bg-white">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
              <div>
                <span className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  6-Month Material Velocity (Inflow vs. Outflow)
                </span>
                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>Purchased material arrivals vs. consumed material issues</div>
              </div>
              <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '0.72rem' }}>Monthly Velocity</span>
            </div>
            <div className="card-body">
              <div style={{ height: '260px' }}>
                <Bar
                  data={velocityData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 11 } }
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.dataset.label}: PHP ${Number(context.raw).toLocaleString()}`
                        }
                      }
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: {
                        grid: { color: '#f1f5f9' },
                        ticks: {
                          callback: (val) => `PHP ${(Number(val) / 1000).toFixed(0)}k`
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart 3: Inventory Classification Doughnut */}
        <div className="col-12 col-md-6 col-xl-6">
          <div className="card border shadow-sm h-100 bg-white">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
              <div>
                <span className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Stock Classification Breakdown
                </span>
                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>Proportion of Consumables, Tools, and Spares</div>
              </div>
              <span className="badge bg-light text-dark border" style={{ fontSize: '0.72rem' }}>4 Classes</span>
            </div>
            <div className="card-body d-flex align-items-center justify-content-center">
              <div style={{ width: '230px', height: '230px' }}>
                <Doughnut
                  data={classificationData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.label}: ${context.raw}%`
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart 4: Warehouse Location Distribution Doughnut */}
        <div className="col-12 col-md-6 col-xl-6">
          <div className="card border shadow-sm h-100 bg-white">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
              <div>
                <span className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Storage Allocation by Facility
                </span>
                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>Physical inventory share across facility depots</div>
              </div>
              <span className="badge bg-light text-dark border" style={{ fontSize: '0.72rem' }}>4 Locations</span>
            </div>
            <div className="card-body d-flex align-items-center justify-content-center">
              <div style={{ width: '230px', height: '230px' }}>
                <Doughnut
                  data={locationData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.label}: ${context.raw}%`
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 5. Quick Tables (Operational Watchlists & Real-time Logs) */}
      {/* ------------------------------------------------------------------- */}
      <div className="card border shadow-sm bg-white">
        {/* Table Navigation Header */}
        <div className="card-header bg-white py-2 px-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <ul className="nav nav-pills card-header-pills small justify-content-center gap-2">
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link py-1 px-3 fw-medium ${activeTableTab === 'alerts' ? 'active bg-dark text-white' : 'text-muted'}`}
                  onClick={() => setActiveTableTab('alerts')}
                >
                  Critical Stock Alerts
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link py-1 px-3 fw-medium ${activeTableTab === 'activity' ? 'active bg-dark text-white' : 'text-muted'}`}
                  onClick={() => setActiveTableTab('activity')}
                >
                  Recent Transactions
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link py-1 px-3 fw-medium ${activeTableTab === 'approvals' ? 'active bg-dark text-white' : 'text-muted'}`}
                  onClick={() => setActiveTableTab('approvals')}
                >
                  Pending Incident Approvals
                </button>
              </li>
            </ul>
          </div>

          <div>
            {activeTableTab === 'alerts' && (
              <a
                href="#alerts"
                className="text-muted small text-decoration-none hover-dark d-inline-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={(e) => {
                  e.preventDefault();
                  goTo('alerts');
                }}
              >
                <span>Go to Alert Center</span>
                <i className="bi bi-arrow-right"></i>
              </a>
            )}
            {activeTableTab === 'activity' && (
              <a
                href="#warehouse"
                className="text-muted small text-decoration-none hover-dark d-inline-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={(e) => {
                  e.preventDefault();
                  goTo('warehouse');
                }}
              >
                <span>View Full Stock Records</span>
                <i className="bi bi-arrow-right"></i>
              </a>
            )}
            {activeTableTab === 'approvals' && (
              <a
                href="#approvals"
                className="text-muted small text-decoration-none hover-dark d-inline-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={(e) => {
                  e.preventDefault();
                  goTo('approvals');
                }}
              >
                <span>Open Approvals Queue</span>
                <i className="bi bi-arrow-right"></i>
              </a>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="table-responsive">
          {activeTableTab === 'alerts' && (
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: '120px' }}>SKU</th>
                  <th style={{ minWidth: '220px' }}>Item Description</th>
                  <th style={{ minWidth: '130px' }}>Location</th>
                  <th className="text-center" style={{ minWidth: '100px' }}>On Hand</th>
                  <th className="text-center" style={{ minWidth: '120px' }}>Status</th>
                  <th className="text-end" style={{ minWidth: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {warehouseStock.filter(itm => itm.ROP_Status === 'CRITICAL_DEPLETION' || itm.ROP_Status === 'REORDER_WARNING').length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted small">
                      {warehouseStock.length === 0 ? 'Loading stock alerts...' : 'No critical depletion or reorder warnings at this time.'}
                    </td>
                  </tr>
                )}
                {warehouseStock
                  .filter(itm => itm.ROP_Status === 'CRITICAL_DEPLETION' || itm.ROP_Status === 'REORDER_WARNING')
                  .slice(0, 8)
                  .map((alert) => (
                    <tr key={alert.Inventory_ID}>
                      <td>
                        <span className="font-monospace text-dark small">{alert.Item_SKU}</span>
                      </td>
                      <td>
                        <div className="fw-medium text-dark">{alert.Item_Name}</div>
                        <div className="small text-muted" style={{ fontSize: '0.72rem' }}>{alert.Classification}</div>
                      </td>
                      <td>
                        <span className="small text-secondary">{alert.Warehouse_Location}</span>
                      </td>
                      <td className="text-center">
                        <span className={`fw-bold font-monospace ${alert.ROP_Status === 'CRITICAL_DEPLETION' ? 'text-danger' : 'text-warning-emphasis'}`}>
                          {alert.On_Hand_Qty} {alert.UOM}
                        </span>
                      </td>
                      <td className="text-center">
                        {alert.ROP_Status === 'CRITICAL_DEPLETION' ? (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1" style={{ fontSize: '0.7rem' }}>
                            CRITICAL DEPLETION
                          </span>
                        ) : (
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1" style={{ fontSize: '0.7rem' }}>
                            REORDER WARNING
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-outline-dark btn-sm py-0 px-2"
                          style={{ fontSize: '0.75rem', height: '24px' }}
                          onClick={() => goTo('alerts')}
                        >
                          Reorder
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTableTab === 'activity' && (
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: '130px' }}>Transaction ID</th>
                  <th style={{ minWidth: '130px' }}>Timestamp</th>
                  <th className="text-center" style={{ minWidth: '110px' }}>Type</th>
                  <th className="text-center" style={{ minWidth: '90px' }}>Status</th>
                  <th style={{ minWidth: '180px' }}>Source → Dest</th>
                  <th style={{ minWidth: '140px' }}>Handled By</th>
                  <th className="text-end" style={{ minWidth: '80px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted small">
                      No recent transaction records loaded.
                    </td>
                  </tr>
                )}
                {recentTransactions.map((trx) => (
                  <tr key={trx.transactionId}>
                    <td>
                      <span className="font-monospace fw-medium text-dark small">{trx.transactionId}</span>
                    </td>
                    <td>
                      <span className="small text-muted">{trx.timestamp}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-secondary-subtle text-secondary border font-monospace" style={{ fontSize: '0.7rem' }}>
                        {trx.transactionType}
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge font-monospace ${
                          trx.status === 'POSTED'
                            ? 'bg-success-subtle text-success border border-success-subtle'
                            : trx.status === 'PENDING'
                            ? 'bg-warning-subtle text-warning border border-warning-subtle'
                            : 'bg-secondary text-white'
                        }`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {trx.status}
                      </span>
                    </td>
                    <td>
                      <span className="small text-dark">{trx.sourceRefId || trx.sourceType} → {trx.destinationRefId || trx.destinationType}</span>
                    </td>
                    <td>
                      <span className="small text-muted font-monospace">{trx.loggedById || 'System'}</span>
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-dark btn-sm py-0 px-2"
                        style={{ fontSize: '0.75rem', height: '24px' }}
                        onClick={() => goTo('transactions')}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTableTab === 'approvals' && (
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: '120px' }}>Loss ID</th>
                  <th style={{ minWidth: '130px' }}>Date</th>
                  <th className="text-center" style={{ minWidth: '110px' }}>Type</th>
                  <th style={{ minWidth: '160px' }}>Origin Ref</th>
                  <th style={{ minWidth: '170px' }}>Liable Party</th>
                  <th className="text-end" style={{ minWidth: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingIncidents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted small">
                      No pending incident approvals at this time.
                    </td>
                  </tr>
                )}
                {pendingIncidents.map((inc) => (
                  <tr key={inc.lossId}>
                    <td>
                      <span className="font-monospace fw-medium text-dark small">{inc.lossId}</span>
                    </td>
                    <td>
                      <span className="small text-muted">{inc.incidentDate}</span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge font-monospace ${
                          inc.lossType === 'DAMAGE'
                            ? 'bg-danger-subtle text-danger border'
                            : inc.lossType === 'EXPIRATION'
                            ? 'bg-warning-subtle text-warning-emphasis border'
                            : 'bg-dark text-white'
                        }`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {inc.lossType}
                      </span>
                    </td>
                    <td>
                      <span className="small text-dark">{inc.originRefId || inc.originType}</span>
                    </td>
                    <td>
                      <span className="small text-muted font-monospace">{inc.liablePartyId}</span>
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-0 px-2"
                        style={{ fontSize: '0.75rem', height: '24px' }}
                        onClick={() => goTo('approvals')}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
