import React, { Suspense, lazy, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { getCurrentUser, getStoredToken, logout, isUserHeadOrAdmin } from './services/auth';
import { getAccess } from './services/access';
import type { UserClaims } from './types';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/DashboardOverview';
import { Footer } from './components/Footer';
import { Error404 } from './pages/404';
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from './services/api';
import { useToast } from './context/ToastContext';
import { Loading } from './components/Loading';

/** Pages other than the sign-in and the first screen load when they are opened, so the first visit downloads less. */
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, name: K) => lazy(() => load().then(m => ({ default: m[name] })));
const AnalyticsHub = page(() => import('./pages/hubs/AnalyticsHub'), 'AnalyticsHub');
const InventoryStockHub = page(() => import('./pages/hubs/InventoryStockHub'), 'InventoryStockHub');
const DeliveriesHub = page(() => import('./pages/hubs/DeliveriesHub'), 'DeliveriesHub');
const ActivitiesHub = page(() => import('./pages/hubs/ActivitiesHub'), 'ActivitiesHub');
const AdminHub = page(() => import('./pages/hubs/AdminHub'), 'AdminHub');
const Configuration = page(() => import('./pages/Configuration'), 'Configuration');
const WarehousePage = page(() => import('./pages/entity/WarehousePage'), 'WarehousePage');
const AreaPage = page(() => import('./pages/entity/AreaPage'), 'AreaPage');
const ItemPage = page(() => import('./pages/entity/ItemPage'), 'ItemPage');
const ActivityPage = page(() => import('./pages/entity/ActivityPage'), 'ActivityPage');
const SubDepartmentPage = page(() => import('./pages/entity/SubDepartmentPage'), 'SubDepartmentPage');
const ComponentTest = page(() => import('./pages/ComponentTest'), 'ComponentTest');

/** Old page addresses (bookmarks, bell links) forward to the matching tab of the new page. */
const LegacyRedirect: React.FC<{ to: (query: URLSearchParams, params: Record<string, string | undefined>) => string }> = ({ to }) => {
  const [query] = useSearchParams();
  const params = useParams();
  return <Navigate to={to(query, params)} replace />;
};

export const App: React.FC = () => {
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const toast = useToast();
  const [currentUser, setCurrentUser] = useState<UserClaims | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Escape closes the top dialog (every dialog has a close button; a busy dialog keeps it disabled)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const close = [...document.querySelectorAll<HTMLButtonElement>('.modal .btn-close:not([disabled])')].pop();
      close?.click();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const hadToken = !!getStoredToken();
    const user = getCurrentUser();
    setCurrentUser(user);
    setIsLoading(false);
    if (hadToken && !user) toast.warning(SESSION_EXPIRED_MESSAGE); // a saved session that ran out while the app was closed

    // Cross-tab synchronization: sync session state when localStorage changes in another tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'jjjei_jwt_token') {
        const updatedUser = getCurrentUser();
        setCurrentUser(updatedUser);
      }
    };

    // The session is over (the API said so, or the token ran out): back to the login screen, with a message
    const handleSessionExpired = () => {
      logout();
      setCurrentUser(null);
      toast.warning(SESSION_EXPIRED_MESSAGE);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [toast]);

  // Log out by itself the moment the token runs out, instead of waiting for the next request to fail
  useEffect(() => {
    if (!currentUser?.exp) return;
    const expMs = currentUser.exp < 1e12 ? currentUser.exp * 1000 : currentUser.exp;
    const wait = expMs - Date.now();
    if (wait > 2147483000) return; // longer than a timer can hold; the next request will notice
    const t = window.setTimeout(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)), Math.max(0, wait));
    return () => window.clearTimeout(t);
  }, [currentUser]);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  const isHeadOrAdmin = isUserHeadOrAdmin(currentUser);
  const canSeeAnalytics = getAccess(currentUser).canSeeAnalytics;
  const canField = getAccess(currentUser).canField;

  if (isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading application...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <HashRouter>
      <div className="min-vh-100 bg-primary bg-opacity-10 d-flex flex-column">
        <Navbar
          user={currentUser}
          onLogout={handleLogout}
          onFeed={(c) => setPendingApprovals(c.approvals)}
        />

        <main className="flex-grow-1">
          <Suspense fallback={<div className="container py-5 text-center"><Loading /></div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<DashboardOverview />} />
            <Route path="/warehouses" element={<Navigate to="/inventory?tab=warehouses" replace />} />
            <Route path="/warehouses/:id" element={<WarehousePage />} />
            <Route path="/areas/:id" element={<AreaPage />} />
            <Route path="/items/:id" element={<ItemPage />} />
            <Route path="/activities/:id" element={<ActivityPage />} />
            <Route path="/sub-departments" element={<Navigate to="/activities?tab=sub-departments" replace />} />
            <Route path="/sub-departments/:id" element={<SubDepartmentPage />} />
            <Route path="/test" element={<ComponentTest />} />
            <Route path="/analytics" element={canSeeAnalytics ? <AnalyticsHub /> : <Navigate to="/overview" replace />} />
            <Route path="/inventory" element={<InventoryStockHub />} />
            <Route path="/deliveries" element={canField ? <DeliveriesHub /> : <Navigate to="/overview" replace />} />
            <Route path="/activities" element={<ActivitiesHub />} />
            <Route path="/transactions" element={<LegacyRedirect to={(q) => { const t = q.get('tab'); return t === 'ledger' ? '/analytics?tab=ledger' : t ? `/inventory?tab=${encodeURIComponent(t)}` : '/inventory'; }} />} />
            <Route path="/configuration" element={isHeadOrAdmin ? <Configuration /> : <Navigate to="/overview" replace />} />
            <Route path="/admin" element={isHeadOrAdmin ? <AdminHub pendingApprovals={pendingApprovals} /> : <Navigate to="/overview" replace />} />

            {/* Old addresses forward to the matching tab */}
            <Route path="/warehouse" element={<Navigate to="/inventory" replace />} />
            <Route path="/catalog" element={<Navigate to="/inventory?tab=catalog" replace />} />
            <Route path="/custody" element={<Navigate to="/inventory?tab=custody" replace />} />
            <Route path="/alerts" element={<Navigate to="/inventory?tab=alerts" replace />} />
            <Route path="/allocation" element={<Navigate to="/activities" replace />} />
            <Route
              path="/receiving"
              element={<LegacyRedirect to={(q) => { const t = q.get('tab'); return t === 'manual' ? '/deliveries?tab=receive-manual' : t === 'pending' ? '/deliveries?tab=tasks' : '/deliveries'; }} />}
            />
            <Route
              path="/costs"
              element={<LegacyRedirect to={(q) => { const t = q.get('tab'); return t === 'price' ? '/admin?tab=price' : t === 'projects' ? '/analytics?tab=projects' : '/analytics?tab=stock'; }} />}
            />
            <Route path="/approvals" element={<Navigate to="/admin" replace />} />
            <Route path="/procurement-mapping" element={<Navigate to="/configuration" replace />} />
            <Route path="/configuration/:subTab" element={<LegacyRedirect to={(_q, p) => `/configuration?table=${encodeURIComponent(p.subTab || '')}`} />} />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Error404 />} />
          </Routes>
          </Suspense>
        </main>

        <Footer />
      </div>
    </HashRouter>
  );
};

export default App;
