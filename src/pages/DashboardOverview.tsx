import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

// ---------------------------------------------------------------------------
// Mock Data Contracts & Datasets
// ---------------------------------------------------------------------------

interface StockAlertItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  location: string;
  onHand: number;
  rop: number;
  safetyStock: number;
  uom: string;
  status: 'CRITICAL_DEPLETION' | 'REORDER_WARNING';
  daysRemaining: number;
}

interface InventoryTransaction {
  id: string;
  refNo: string;
  timestamp: string;
  type: 'RECEIPT' | 'ISSUANCE' | 'RETURN' | 'DISPOSAL';
  sku: string;
  itemName: string;
  qty: number;
  uom: string;
  recipientOrSource: string;
  performedBy: string;
}

interface PendingIncidentApproval {
  lossId: string;
  incidentDate: string;
  lossType: 'DAMAGE' | 'EXPIRATION' | 'UNACCOUNTED_LOSS';
  originRef: string;
  liableParty: string;
  estimatedCost: number;
  description: string;
}

const MOCK_STOCK_ALERTS: StockAlertItem[] = [
  {
    id: 'ITM-0004',
    sku: 'CNS-PLB-0004',
    name: 'PPR Gate Valve 1in Heavy Duty',
    category: 'Plumbing',
    location: 'WH-MAIN (Rack B-03)',
    onHand: 4,
    rop: 15,
    safetyStock: 8,
    uom: 'pc',
    status: 'CRITICAL_DEPLETION',
    daysRemaining: 3
  },
  {
    id: 'ITM-0012',
    sku: 'CNS-ELE-0012',
    name: 'THHN Stranded Wire 3.5mm² (150m)',
    category: 'Electrical',
    location: 'WH-MAIN (Aisle 2)',
    onHand: 2,
    rop: 8,
    safetyStock: 4,
    uom: 'box',
    status: 'CRITICAL_DEPLETION',
    daysRemaining: 5
  },
  {
    id: 'ITM-0028',
    sku: 'CNS-HVA-0028',
    name: 'Refrigerant R-410A Cylinder (11.3kg)',
    category: 'HVAC',
    location: 'WH-NORTH (Depot)',
    onHand: 3,
    rop: 10,
    safetyStock: 5,
    uom: 'cyl',
    status: 'CRITICAL_DEPLETION',
    daysRemaining: 4
  },
  {
    id: 'ITM-0019',
    sku: 'CNS-PLB-0019',
    name: 'Solvent Cement Heavy Duty 500ml',
    category: 'Plumbing',
    location: 'WH-MAIN (Rack A-01)',
    onHand: 11,
    rop: 24,
    safetyStock: 12,
    uom: 'can',
    status: 'REORDER_WARNING',
    daysRemaining: 14
  },
  {
    id: 'ITM-0045',
    sku: 'SPR-HVA-0045',
    name: 'Air Filter Media Roll 20mm x 2m',
    category: 'HVAC',
    location: 'WH-NORTH (Rack C-02)',
    onHand: 6,
    rop: 12,
    safetyStock: 6,
    uom: 'mtr',
    status: 'REORDER_WARNING',
    daysRemaining: 18
  },
  {
    id: 'ITM-0062',
    sku: 'CNS-CIV-0062',
    name: 'Portland Cement Type 1 40kg',
    category: 'Civil',
    location: 'North Yard Storage',
    onHand: 18,
    rop: 35,
    safetyStock: 20,
    uom: 'bag',
    status: 'REORDER_WARNING',
    daysRemaining: 21
  }
];

const MOCK_RECENT_TRANSACTIONS: InventoryTransaction[] = [
  {
    id: 'TRX-2026-0891',
    refNo: 'MAT-ISS-0419',
    timestamp: '2026-09-29 09:30',
    type: 'ISSUANCE',
    sku: 'CNS-PLB-0001',
    itemName: 'PPR Pipe 1/2in x 4m PN20',
    qty: 12,
    uom: 'pc',
    recipientOrSource: 'HVAC Repair Tower 2',
    performedBy: 'm.santos (Lead Tech)'
  },
  {
    id: 'TRX-2026-0890',
    refNo: 'PO-REC-2026-114',
    timestamp: '2026-09-29 08:15',
    type: 'RECEIPT',
    sku: 'CNS-ELE-0009',
    itemName: 'LED Batten Luminaire 18W Daylight',
    qty: 50,
    uom: 'pc',
    recipientOrSource: 'Supplier: First Mega Electrical',
    performedBy: 'warehouse.custodian'
  },
  {
    id: 'TRX-2026-0889',
    refNo: 'TOOL-RET-0192',
    timestamp: '2026-09-28 17:05',
    type: 'RETURN',
    sku: 'TLS-PWR-0003',
    itemName: 'Rotary Hammer SDS-Plus 800W',
    qty: 1,
    uom: 'set',
    recipientOrSource: 'Civil Team A',
    performedBy: 'r.delacruz (Technician)'
  },
  {
    id: 'TRX-2026-0888',
    refNo: 'MAT-ISS-0418',
    timestamp: '2026-09-28 14:40',
    type: 'ISSUANCE',
    sku: 'CNS-HDW-0033',
    itemName: 'Teflon Tape 3/4in x 10m',
    qty: 10,
    uom: 'roll',
    recipientOrSource: 'Plumbing Preventive Maint.',
    performedBy: 'j.reyes (Technician)'
  },
  {
    id: 'TRX-2026-0887',
    refNo: 'SCRAP-DISP-0012',
    timestamp: '2026-09-28 11:20',
    type: 'DISPOSAL',
    sku: 'SPR-PLB-0015',
    itemName: 'Cast Iron Drain Grate 4in',
    qty: 3,
    uom: 'pc',
    recipientOrSource: 'Authorised Scrap Yard',
    performedBy: 'warehouse.head'
  }
];

const MOCK_PENDING_INCIDENTS: PendingIncidentApproval[] = [
  {
    lossId: 'LOSS-2026-0001',
    incidentDate: '2026-09-27 14:20',
    lossType: 'DAMAGE',
    originRef: 'WH-MAIN (Forklift Aisle 3)',
    liableParty: 'technician.m@jjjei.com',
    estimatedCost: 8450.00,
    description: 'PPR pipe bundles cracked during forklift transit maneuver. High-pressure integrity compromised.'
  },
  {
    lossId: 'LOSS-2026-0002',
    incidentDate: '2026-09-28 08:45',
    lossType: 'EXPIRATION',
    originRef: 'WH-MAIN (Flammables Cabinet)',
    liableParty: 'custodian.warehouse@jjjei.com',
    estimatedCost: 6200.00,
    description: 'Epoxy resin hardener canisters surpassed chemical shelf life; solidified inside containers.'
  },
  {
    lossId: 'LOSS-2026-0003',
    incidentDate: '2026-09-28 16:30',
    lossType: 'UNACCOUNTED_LOSS',
    originRef: 'TL-ENG (Toolroom Locker 4)',
    liableParty: 'pending.investigation@jjjei.com',
    estimatedCost: 13800.00,
    description: 'Digital insulation multimeter unaccounted for during quarterly custody physical cycle count.'
  }
];

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [activeTableTab, setActiveTableTab] = useState<'alerts' | 'activity' | 'approvals'>('alerts');
  const [isEvaluatingRop, setIsEvaluatingRop] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);

  const goTo = (pathOrTab: string) => {
    const routeMap: Record<string, string> = {
      overview: '/overview',
      catalog: '/catalog',
      warehouse: '/warehouse',
      alerts: '/alerts',
      approvals: '/approvals',
      config: '/configuration/item',
      configuration: '/configuration/item'
    };
    const target = routeMap[pathOrTab] || (pathOrTab.startsWith('/') ? pathOrTab : `/${pathOrTab}`);
    navigate(target);
    if (onNavigate) {
      onNavigate(pathOrTab);
    }
  };

  // Quick interactive ROP simulation
  const handleTriggerRop = () => {
    setIsEvaluatingRop(true);
    setEvaluationFeedback(null);
    setTimeout(() => {
      setIsEvaluatingRop(false);
      setEvaluationFeedback('ROP evaluation complete: 3 critical items and 7 reorder warnings re-verified.');
      setTimeout(() => setEvaluationFeedback(null), 6000);
    }, 1200);
  };

  // ---------------------------------------------------------------------------
  // Chart Configs (Modern Slate / Minimalist Theme)
  // ---------------------------------------------------------------------------

  // Chart 1: Valuation by Trade Scope (PHP)
  const categoryValuationData = {
    labels: [
      'Plumbing (PLB)',
      'Electrical (ELE)',
      'HVAC & Ref (HVA)',
      'Power Tools (PWR)',
      'Civil & Masonry (CIV)',
      'Hardware (HDW)'
    ],
    datasets: [
      {
        label: 'Asset Valuation (PHP)',
        data: [1340000, 1120000, 1260000, 680000, 425450, 310000],
        backgroundColor: '#1e293b',
        hoverBackgroundColor: '#0f172a',
        borderRadius: 4,
        maxBarThickness: 32
      }
    ]
  };

  // Chart 2: Inventory Classification Breakdown
  const classificationData = {
    labels: ['Consumables (CNS)', 'Tools & Equipment (TLS)', 'Spare Parts (SPR)', 'Misc (MSC)'],
    datasets: [
      {
        data: [58, 22, 14, 6],
        backgroundColor: ['#0f172a', '#334155', '#64748b', '#cbd5e1'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  // Chart 3: 6-Month Inventory Velocity (Procured vs Issued)
  const velocityData = {
    labels: ['May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026 (Est.)'],
    datasets: [
      {
        label: 'Procured / Stock In (PHP)',
        data: [420000, 560000, 380000, 620000, 490000, 510000],
        backgroundColor: '#0f172a',
        borderRadius: 3,
        maxBarThickness: 16
      },
      {
        label: 'Issued to Work Orders (PHP)',
        data: [390000, 480000, 410000, 540000, 460000, 430000],
        backgroundColor: '#94a3b8',
        borderRadius: 3,
        maxBarThickness: 16
      }
    ]
  };

  // Chart 4: Warehouse Storage Distribution
  const locationData = {
    labels: ['Main Facility (WH-MAIN)', 'North Yard (WH-NORTH)', 'Engineering Toolroom (TL-ENG)', 'Sub-Depots'],
    datasets: [
      {
        data: [52, 26, 14, 8],
        backgroundColor: ['#1e293b', '#475569', '#94a3b8', '#e2e8f0'],
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
              PHP 5.14M
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
              184 Items
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
              3 Items
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
              7 Items
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
              3 Incidents
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
                <i className="bi bi-box-seam text-secondary fs-5"></i>
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
                <i className="bi bi-buildings text-secondary fs-5"></i>
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
                <i className="bi bi-exclamation-triangle text-danger fs-5"></i>
                <div className="text-truncate">
                  <div className="fw-semibold small text-truncate" style={{ fontSize: '0.82rem' }}>Stockout Alerts</div>
                  <div className="text-danger text-truncate" style={{ fontSize: '0.7rem' }}>10 items reorder</div>
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
                <i className="bi bi-clipboard-check text-warning-emphasis fs-5"></i>
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
                <i className="bi bi-sliders text-secondary fs-5"></i>
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
                <i className={`bi bi-arrow-repeat text-primary fs-5 ${isEvaluatingRop ? 'spin-animation' : ''}`}></i>
                <div className="text-truncate">
                  <div className="fw-semibold small text-truncate" style={{ fontSize: '0.82rem' }}>
                    {isEvaluatingRop ? 'Evaluating...' : 'Evaluate ROP'}
                  </div>
                  <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Lead-time math</div>
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
                  <th className="text-center" style={{ minWidth: '100px' }}>Safety ROP</th>
                  <th className="text-center" style={{ minWidth: '120px' }}>Status</th>
                  <th className="text-end" style={{ minWidth: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_STOCK_ALERTS.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <span className="font-monospace text-dark small">{alert.sku}</span>
                    </td>
                    <td>
                      <div className="fw-medium text-dark">{alert.name}</div>
                      <div className="small text-muted" style={{ fontSize: '0.72rem' }}>{alert.category} Supplies</div>
                    </td>
                    <td>
                      <span className="small text-secondary">{alert.location}</span>
                    </td>
                    <td className="text-center">
                      <span className={`fw-bold font-monospace ${alert.status === 'CRITICAL_DEPLETION' ? 'text-danger' : 'text-warning-emphasis'}`}>
                        {alert.onHand} {alert.uom}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="small text-muted font-monospace">{alert.rop} {alert.uom} (Min: {alert.safetyStock})</span>
                    </td>
                    <td className="text-center">
                      {alert.status === 'CRITICAL_DEPLETION' ? (
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
                  <th style={{ minWidth: '120px' }}>Ref / Doc No</th>
                  <th style={{ minWidth: '130px' }}>Timestamp</th>
                  <th className="text-center" style={{ minWidth: '100px' }}>Type</th>
                  <th style={{ minWidth: '220px' }}>Item Description</th>
                  <th className="text-center" style={{ minWidth: '90px' }}>Quantity</th>
                  <th style={{ minWidth: '170px' }}>Source / Recipient</th>
                  <th style={{ minWidth: '140px' }}>Handled By</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_RECENT_TRANSACTIONS.map((trx) => (
                  <tr key={trx.id}>
                    <td>
                      <span className="font-monospace fw-medium text-dark small">{trx.refNo}</span>
                    </td>
                    <td>
                      <span className="small text-muted">{trx.timestamp}</span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge font-monospace ${
                          trx.type === 'RECEIPT'
                            ? 'bg-success-subtle text-success border'
                            : trx.type === 'ISSUANCE'
                            ? 'bg-primary-subtle text-primary border'
                            : trx.type === 'RETURN'
                            ? 'bg-info-subtle text-info border'
                            : 'bg-secondary-subtle text-secondary border'
                        }`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {trx.type}
                      </span>
                    </td>
                    <td>
                      <div className="fw-medium text-dark">{trx.itemName}</div>
                      <div className="font-monospace text-muted" style={{ fontSize: '0.72rem' }}>{trx.sku}</div>
                    </td>
                    <td className="text-center">
                      <span className="fw-bold font-monospace text-dark">
                        {trx.type === 'ISSUANCE' || trx.type === 'DISPOSAL' ? `-${trx.qty}` : `+${trx.qty}`} {trx.uom}
                      </span>
                    </td>
                    <td>
                      <span className="small text-dark">{trx.recipientOrSource}</span>
                    </td>
                    <td>
                      <span className="small text-muted font-monospace">{trx.performedBy}</span>
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
                  <th className="text-end" style={{ minWidth: '110px' }}>Est. Cost</th>
                  <th className="text-end" style={{ minWidth: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PENDING_INCIDENTS.map((inc) => (
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
                      <span className="small text-dark">{inc.originRef}</span>
                    </td>
                    <td>
                      <span className="small text-muted font-monospace">{inc.liableParty}</span>
                    </td>
                    <td className="text-end">
                      <span className="font-monospace fw-semibold text-dark small">
                        PHP {inc.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
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
