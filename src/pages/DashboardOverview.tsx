import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import { getCurrentUser, isUserHeadOrAdmin } from '../services/auth';
import { getAccess } from '../services/access';
import type { WarehouseStockItem, LossIncident, InHouseCustodyItem } from '../types';
import { useToast } from '../context/ToastContext';
import { Loading } from '../components/Loading';
import { RefreshButton } from '../components/RefreshButton';
import { DashboardWidgets, DraftsList } from '../components/dashboard/DashboardWidgets';
import { useAssignmentMode } from '../components/receiving/useAssignmentMode';
import { pushRecent, readRecent, type RecentEntry } from '../services/recent';

/** 'just now', '3 min ago', '2 h ago' */
const ago = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
};

type Load = 'loading' | 'ready' | 'error';
interface DashboardOverviewProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const access = getAccess(getCurrentUser());
  const navigate = useNavigate();
  const toast = useToast();
  const [isEvaluatingRop, setIsEvaluatingRop] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);

  // Live Data States
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockItem[]>([]);
  const [pendingIncidents, setPendingIncidents] = useState<LossIncident[]>([]);
  const [custodyItems, setCustodyItems] = useState<InHouseCustodyItem[]>([]);
  // per source: a tile shows a placeholder until its data arrives, never a false 0
  const [stockLoad, setStockLoad] = useState<Load>('loading');
  const [custodyLoad, setCustodyLoad] = useState<Load>('loading');
  const [incidentLoad, setIncidentLoad] = useState<Load>(isUserHeadOrAdmin(getCurrentUser()) ? 'loading' : 'ready'); // only heads fetch the queue
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isHead = isUserHeadOrAdmin(getCurrentUser());

  const loadAll = (force = false) => {
    if (force) { invalidateCache('inventory:stock:all'); invalidateCache('custody:list:ACTIVE'); invalidateCache('incident:queue:PENDING_APPROVAL'); setRefreshing(true); ['dash:', 'catalog:items'].forEach(k => invalidateCache(k)); setRefreshKey(n => n + 1); }
    const persist = { persist: true };
    const done = (set: (l: Load) => void) => (data: unknown, _c: boolean, at: number) => { if (Array.isArray(data)) { set('ready'); setUpdatedAt(prev => Math.max(prev ?? 0, at)); } };
    const failed = (set: (l: Load) => void) => (err: unknown) => { console.warn('Dashboard fetch fallback:', err); set('error'); };

    // 1. Fetch live warehouse stock for KPIs and stock alerts
    const stock = fetchWithSwr(
      'inventory:stock:all',
      () => apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock'),
      (data, c, at) => { if (Array.isArray(data)) setWarehouseStock(data); done(setStockLoad)(data, c, at); },
      persist
    ).catch(failed(setStockLoad));

    // Tools currently with technicians (same cache entry as the Tool Custody register)
    const custody = fetchWithSwr(
      'custody:list:ACTIVE',
      () => apiRequest<InHouseCustodyItem[]>('custody:getList', { status: 'ACTIVE' }),
      (data, c, at) => { if (Array.isArray(data)) setCustodyItems(data); done(setCustodyLoad)(data, c, at); },
      persist
    ).catch(failed(setCustodyLoad));
    const jobs: Promise<unknown>[] = [stock, custody];

    // 2. Fetch pending incidents for the Pending Loss Approvals count (Head / Super Admin only)
    if (isHead) {
      jobs.push(fetchWithSwr(
        'incident:queue:PENDING_APPROVAL',
        () => apiRequest<LossIncident[]>('incident:getQueue', { status: 'PENDING_APPROVAL' }),
        (data, c, at) => { if (Array.isArray(data)) setPendingIncidents(data); done(setIncidentLoad)(data, c, at); },
        persist
      ).catch(failed(setIncidentLoad)));
    }
    Promise.all(jobs).finally(() => setRefreshing(false));
  };

  useEffect(() => {
    loadAll();
    const t = window.setInterval(() => tick(n => n + 1), 30000); // keeps "updated x min ago" honest
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (pathOrTab: string) => {
    const routeMap: Record<string, string> = {
      overview: '/overview',
      catalog: '/inventory?tab=catalog',
      warehouse: '/inventory',
      transactions: '/analytics?tab=ledger',
      receiving: '/inventory?tab=pending',
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
      toast.error(`ROP evaluation failed: ${err.message}`);
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
  const shown = (load: Load, v: string) => (load === 'ready' ? v : load === 'error' ? '–' : null);
  const kpis: { label: string; load: Load; value: string; unit: string; to: string; title: string; alert?: KpiTone; show?: boolean }[] = [
    { label: 'Tracked inventory', load: stockLoad, value: String(totalTrackedItems), unit: 'items', to: 'catalog', title: 'View the inventory catalog' },
    { label: 'Critical stockout', load: stockLoad, value: String(criticalCount), unit: 'items', to: 'alerts', title: 'View critical stockouts in the reorder alerts', alert: criticalCount > 0 ? 'danger' : undefined },
    { label: 'Reorder warnings', load: stockLoad, value: String(warningCount), unit: 'items', to: 'alerts', title: 'View reorder warnings in the reorder alerts', alert: warningCount > 0 ? 'warning' : undefined },
    { label: 'Incident verification', load: incidentLoad, value: String(incidentsCount), unit: incidentsCount === 1 ? 'incident' : 'incidents', to: 'approvals', title: 'View pending incident approvals', alert: incidentsCount > 0 ? 'warning' : undefined },
    { label: 'Custody assets', load: custodyLoad, value: String(custodyToolCount), unit: custodyToolCount === 1 ? 'tool' : 'tools', to: 'warehouse', title: 'View in-house custody and assigned assets' }
  ];

  // Tasks for this role (the top navigation already covers browsing): what the person can open, and what needs them now
  const { assignment } = useAssignmentMode();
  const actions: { label: string; note: string; onClick: () => void; title?: string; show?: boolean; disabled?: boolean; busy?: boolean }[] = [
    { label: assignment ? (access.isAdmin ? 'MRLs to assign' : 'My assignments') : 'Receive stock', note: assignment ? 'Released MRLs waiting for a verifier' : 'From an MRL or manually', onClick: () => goTo(assignment ? (access.isAdmin ? '/inventory?tab=assign' : '/inventory?tab=assignments') : '/inventory?tab=receive-mrl'), show: access.isCustodian },
    { label: 'Pending receipts', note: 'Confirm what arrived', onClick: () => goTo('/inventory?tab=pending'), show: access.canField },
    { label: 'Log usage', note: 'Record materials consumed', onClick: () => goTo('/activities?tab=consumption'), show: access.canField },
    { label: access.fieldOnly ? 'My tools' : 'Tool custody', note: access.fieldOnly ? 'Tools assigned to you' : 'Who holds which tool', onClick: () => goTo('/inventory?tab=custody'), show: access.canField },
    { label: 'Stockout alerts', note: reorderCount === 0 ? 'No items to reorder' : `${reorderCount} ${reorderCount === 1 ? 'item' : 'items'} to reorder`, onClick: () => goTo('alerts') },
    { label: 'Review approvals', note: incidentsCount === 0 ? 'Nothing waiting' : `${incidentsCount} waiting`, onClick: () => goTo('approvals'), show: access.isAdmin },
    { label: 'Configuration', note: 'Master references', onClick: () => goTo('config'), show: access.isAdmin },
    { label: 'Check reorder point', note: 'Lead-time calculation', onClick: handleTriggerRop, disabled: isEvaluatingRop, busy: isEvaluatingRop, title: 'Run reorder point algorithms across all warehouses', show: access.isCustodian }
  ];

  // what this person opened from the dashboard last (see services/recent.ts)
  const userId = access.id || access.email;
  const [recent, setRecent] = useState<RecentEntry[]>(() => readRecent(userId));
  const shownActions = actions.filter(x => x.show !== false);
  const recentShown = recent.filter(r => r.to || shownActions.some(a => a.label === r.label)).slice(0, 4);
  const open = (r: { label: string; to?: string }) => {
    setRecent(pushRecent(userId, r));
    if (r.to) goTo(r.to); else shownActions.find(a => a.label === r.label)?.onClick();
  };
  const run = (x: (typeof actions)[number]) => open({ label: x.label });

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
      <div className="card border shadow-sm bg-white mb-3">
        <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
          <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Overview</div>
          <div className="d-flex align-items-center gap-2 small text-muted">
            {updatedAt && <span>Updated {ago(updatedAt)}</span>}
            <RefreshButton onClick={() => loadAll(true)} loading={refreshing} />
          </div>
        </div>
        <div className="card-body">
      <div className="kpi-grid">
        {kpis.filter(k => k.show !== false).map(k => (
          <div key={k.label}>
            <div
              className={`kpi-card h-100${k.alert ? ` kpi-${k.alert}` : ''}`}
              onClick={() => open({ label: k.label, to: k.to })}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open({ label: k.label, to: k.to }); } }}
              role="button"
              tabIndex={0}
              title={k.title}
            >
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">
                {shown(k.load, k.value) === null
                  ? <span className="kpi-skeleton" role="status" aria-label="Loading"></span>
                  : <>{shown(k.load, k.value)}{k.load === 'ready' && <span className="kpi-unit">{k.unit}</span>}</>}
              </div>
              {k.load === 'error' && <div className="kpi-unit ms-0">Couldn't load, use Refresh</div>}
            </div>
          </div>
        ))}
      </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Quick actions (buttons) and the ones this person used last */}
      {/* ------------------------------------------------------------------- */}
      <div className="card border shadow-sm bg-white mb-3">
        <div className="card-body py-3">
          <div className="row g-3">
            <div className="col-12 col-lg-5">
              <div className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Quick actions</div>
              <div className="d-flex flex-wrap gap-2">
                {shownActions.map(x => (
                  <button key={x.label} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => run(x)} disabled={x.disabled} title={x.title || x.note}>
                    {x.busy ? <Loading variant="text" label="Checking..." /> : x.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-12 col-lg-4 border-lg-start ps-lg-4">
              <div className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Recent actions</div>
              {recentShown.length === 0
                ? <div className="small text-muted">Actions you use appear here.</div>
                : (
                  <ul className="list-unstyled mb-0 small">
                    {recentShown.map(r => (
                      <li key={r.label} className="d-flex justify-content-between align-items-center gap-2 py-1">
                        <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none text-start" onClick={() => open(r)}>{r.label}</button>
                        <span className="text-muted text-nowrap">{ago(r.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
            <div className="col-12 col-lg-3 border-lg-start ps-lg-4">
              <div className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Drafts</div>
              <DraftsList refreshKey={refreshKey} />
            </div>
          </div>
        </div>
      </div>

      <DashboardWidgets stock={warehouseStock} stockState={stockLoad} incidents={pendingIncidents} refreshKey={refreshKey} />
    </div>
  );
};
