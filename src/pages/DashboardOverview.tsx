import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import { getCurrentUser, isUserHeadOrAdmin } from '../services/auth';
import { getAccess } from '../services/access';
import type { WarehouseStockItem, LossIncident, InHouseCustodyItem } from '../types';
import { Loading } from '../components/Loading';
interface DashboardOverviewProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const access = getAccess(getCurrentUser());
  const navigate = useNavigate();
  const [isEvaluatingRop, setIsEvaluatingRop] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);

  // Live Data States
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockItem[]>([]);
  const [pendingIncidents, setPendingIncidents] = useState<LossIncident[]>([]);
  const [custodyItems, setCustodyItems] = useState<InHouseCustodyItem[]>([]);

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

    // Tools currently with technicians (same cache entry as the Tool Custody register)
    fetchWithSwr(
      'custody:list:ACTIVE',
      () => apiRequest<InHouseCustodyItem[]>('custody:getList', { status: 'ACTIVE' }),
      (data) => {
        if (Array.isArray(data)) setCustodyItems(data);
      }
    ).catch(err => console.warn('Dashboard custody fetch fallback:', err));

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
  const totalTrackedItems = warehouseStock.length;
  const criticalStockItems = warehouseStock.filter(itm => itm.ROP_Status === 'CRITICAL_DEPLETION');
  const warningStockItems = warehouseStock.filter(itm => itm.ROP_Status === 'REORDER_WARNING');
  const criticalCount = criticalStockItems.length;
  const warningCount = warningStockItems.length;
  const incidentsCount = pendingIncidents.length;
  const custodyToolCount = custodyItems.reduce((n, c) => n + (Number(c.Quantity) || 1), 0);
  const reorderCount = criticalCount + warningCount;

  type KpiTone = 'danger' | 'warning' | undefined;
  const kpis: { label: string; value: string; unit: string; to: string; title: string; alert?: KpiTone; show?: boolean }[] = [
    { label: 'Tracked inventory', value: String(totalTrackedItems), unit: 'items', to: 'catalog', title: 'View the inventory catalog' },
    { label: 'Critical stockout', value: String(criticalCount), unit: 'items', to: 'alerts', title: 'View critical stockouts in the reorder alerts', alert: criticalCount > 0 ? 'danger' : undefined },
    { label: 'Reorder warnings', value: String(warningCount), unit: 'items', to: 'alerts', title: 'View reorder warnings in the reorder alerts', alert: warningCount > 0 ? 'warning' : undefined },
    { label: 'Incident verification', value: String(incidentsCount), unit: incidentsCount === 1 ? 'incident' : 'incidents', to: 'approvals', title: 'View pending incident approvals', alert: incidentsCount > 0 ? 'warning' : undefined },
    { label: 'Custody assets', value: String(custodyToolCount), unit: custodyToolCount === 1 ? 'tool' : 'tools', to: 'warehouse', title: 'View in-house custody and assigned assets' }
  ];

  const actions: { label: string; note: string; onClick: () => void; title?: string; show?: boolean; disabled?: boolean; busy?: boolean }[] = [
    { label: 'Item masterlist', note: 'Catalog and specs', onClick: () => goTo('catalog') },
    { label: 'Warehouse stock', note: 'Locations and bins', onClick: () => goTo('warehouse') },
    { label: 'Stockout alerts', note: reorderCount === 0 ? 'No items to reorder' : `${reorderCount} ${reorderCount === 1 ? 'item' : 'items'} to reorder`, onClick: () => goTo('alerts') },
    { label: 'Approvals queue', note: 'Incident sign-offs', onClick: () => goTo('approvals') },
    { label: 'Configuration', note: 'Master references', onClick: () => goTo('config') },
    { label: 'Check reorder point', note: 'Lead-time calculation', onClick: handleTriggerRop, disabled: isEvaluatingRop, busy: isEvaluatingRop, title: 'Run reorder point algorithms across all warehouses', show: access.isCustodian }
  ];

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
      {/* 2. Key figures: label, one number, a quiet unit. Colour only when something needs attention. */}
      {/* ------------------------------------------------------------------- */}
      <div className="kpi-grid mb-4">
        {kpis.filter(k => k.show !== false).map(k => (
          <div key={k.label}>
            <div
              className={`kpi-card h-100${k.alert ? ` kpi-${k.alert}` : ''}`}
              onClick={() => goTo(k.to)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(k.to); } }}
              role="button"
              tabIndex={0}
              title={k.title}
            >
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}<span className="kpi-unit">{k.unit}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Quick actions: plain tiles, same look as the KPIs */}
      {/* ------------------------------------------------------------------- */}
      <div className="kpi-section-title">Quick actions</div>
      <div className="kpi-grid mb-4">
        {actions.filter(x => x.show !== false).map(x => (
          <div key={x.label}>
            <button type="button" className="kpi-card kpi-action h-100 w-100 text-start" onClick={x.onClick} disabled={x.disabled} title={x.title}>
              <div className="kpi-action-title">{x.busy ? <Loading variant="text" label="Checking..." /> : x.label}</div>
              <div className="kpi-action-note">{x.note}</div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
