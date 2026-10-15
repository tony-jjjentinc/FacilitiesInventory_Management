import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import { getCurrentUser, isUserHeadOrAdmin } from '../services/auth';
import { getAccess } from '../services/access';
import type { WarehouseStockItem, LossIncident, InHouseCustodyItem } from '../types';
import { RefreshButton } from '../components/RefreshButton';
import { DashboardWidgets, DraftsList } from '../components/dashboard/DashboardWidgets';
import { pushRecent, readRecent, type RecentEntry } from '../services/recent';
import { fmtAgo } from '../utils/datetime';
import { UnpricedBanner } from '../components/UnpricedBanner';
import { KpiTile } from '../components/charts';

const ago = fmtAgo;

type Load = 'loading' | 'ready' | 'error';
interface DashboardOverviewProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const access = getAccess(getCurrentUser());
  const navigate = useNavigate();

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
      receiving: '/deliveries?tab=tasks',
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

  // Live KPI Calculations
  const totalTrackedItems = warehouseStock.length;
  const criticalCount = warehouseStock.filter(itm => itm.ROP_Status === 'CRITICAL_DEPLETION').length;
  const warningCount = warehouseStock.filter(itm => itm.ROP_Status === 'REORDER_WARNING').length;
  const incidentsCount = pendingIncidents.length;
  const custodyToolCount = custodyItems.reduce((n, c) => n + (Number(c.Quantity) || 1), 0);

  type KpiTone = 'danger' | 'warning' | undefined;
  const shown = (load: Load, v: string) => (load === 'ready' ? v : load === 'error' ? '–' : null);
  const kpis: { label: string; load: Load; value: string; unit: string; to: string; title: string; alert?: KpiTone; show?: boolean }[] = [
    { label: 'Tracked inventory', load: stockLoad, value: String(totalTrackedItems), unit: 'items', to: 'catalog', title: 'View the inventory catalog' },
    { label: 'Critical stockout', load: stockLoad, value: String(criticalCount), unit: 'items', to: 'alerts', title: 'View critical stockouts in the reorder alerts', alert: criticalCount > 0 ? 'danger' : undefined },
    { label: 'Reorder warnings', load: stockLoad, value: String(warningCount), unit: 'items', to: 'alerts', title: 'View reorder warnings in the reorder alerts', alert: warningCount > 0 ? 'warning' : undefined },
    { label: 'Incident verification', load: incidentLoad, value: String(incidentsCount), unit: incidentsCount === 1 ? 'incident' : 'incidents', to: 'approvals', title: 'View pending incident approvals', alert: incidentsCount > 0 ? 'warning' : undefined },
    { label: 'Custody assets', load: custodyLoad, value: String(custodyToolCount), unit: custodyToolCount === 1 ? 'tool' : 'tools', to: 'warehouse', title: 'View in-house custody and assigned assets' }
  ];

  // what this person opened from the dashboard last (see services/recent.ts)
  const userId = access.id || access.email;
  const [recent, setRecent] = useState<RecentEntry[]>(() => readRecent(userId));
  const recentShown = recent.filter(r => r.to).slice(0, 4);
  const open = (r: { label: string; to?: string }) => {
    setRecent(pushRecent(userId, r));
    if (r.to) goTo(r.to);
  };

  return (
    <div className="container py-4 px-3 px-md-4">
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
            <KpiTile label={k.label} unit={k.unit} alert={k.alert} title={k.title} state={k.load}
              value={shown(k.load, k.value)} onClick={() => open({ label: k.label, to: k.to })} />
          </div>
        ))}
      </div>
        </div>
      </div>

      <UnpricedBanner stock={warehouseStock} />
      <DashboardWidgets stock={warehouseStock} stockState={stockLoad} incidents={pendingIncidents} refreshKey={refreshKey} />

      {/* ------------------------------------------------------------------- */}
      {/* Others: what this person opened last, and their saved drafts (last on purpose: it fills in after the rest) */}
      {/* ------------------------------------------------------------------- */}
      <div className="card border shadow-sm bg-white mb-3">
        <div className="card-header bg-white border-bottom">
          <div className="fw-semibold small text-uppercase text-muted" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Others</div>
        </div>
        <div className="card-body py-3">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Recent actions</div>
              {recentShown.length === 0
                ? <div className="small text-muted">Things you open from the dashboard appear here.</div>
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
            <div className="col-12 col-md-6 border-md-start ps-md-4">
              <div className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>Drafts</div>
              <DraftsList refreshKey={refreshKey} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
