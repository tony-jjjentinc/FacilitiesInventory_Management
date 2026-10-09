import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { getCurrentUser, logout, isUserHeadOrAdmin } from './services/auth';
import type { UserClaims } from './types';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/DashboardOverview';
import { AnalyticsHub } from './pages/hubs/AnalyticsHub';
import { InventoryStockHub } from './pages/hubs/InventoryStockHub';
import { ActivitiesHub } from './pages/hubs/ActivitiesHub';
import { TransactionsHub } from './pages/hubs/TransactionsHub';
import { AdminHub } from './pages/hubs/AdminHub';
import { Configuration } from './pages/Configuration';
import { Error404 } from './pages/404';
import { useSystemInfo } from './context/SystemContext';
import { SESSION_EXPIRED_EVENT } from './services/api';
import { Logo } from './components/Logo';

/** Old page addresses (bookmarks, bell links) forward to the matching tab of the new page. */
const LegacyRedirect: React.FC<{ to: (query: URLSearchParams, params: Record<string, string | undefined>) => string }> = ({ to }) => {
  const [query] = useSearchParams();
  const params = useParams();
  return <Navigate to={to(query, params)} replace />;
};

export const App: React.FC = () => {
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const { systemInfo } = useSystemInfo();
  const [currentUser, setCurrentUser] = useState<UserClaims | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setIsLoading(false);

    // Cross-tab synchronization: sync session state when localStorage changes in another tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'jjjei_jwt_token') {
        const updatedUser = getCurrentUser();
        setCurrentUser(updatedUser);
      }
    };

    const handleSessionExpired = () => setCurrentUser(null);

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  const isHeadOrAdmin = isUserHeadOrAdmin(currentUser);
  const canSeeAnalytics = (currentUser?.roles || []).some(r => ['super admin', 'head', 'sub-department'].includes(String(r).trim().toLowerCase()));

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
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<DashboardOverview />} />
            <Route path="/analytics" element={canSeeAnalytics ? <AnalyticsHub /> : <Navigate to="/overview" replace />} />
            <Route path="/inventory" element={<InventoryStockHub />} />
            <Route path="/activities" element={<ActivitiesHub />} />
            <Route path="/transactions" element={<TransactionsHub />} />
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
              element={<LegacyRedirect to={(q) => { const t = q.get('tab'); return t === 'manual' ? '/transactions?tab=receive-manual' : t === 'pending' ? '/transactions?tab=pending' : '/transactions'; }} />}
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
        </main>

        <footer className="py-3 text-center small text-muted mt-auto">
          <div className="container-fluid d-flex flex-column flex-md-row justify-content-center justify-content-between align-items-center px-3">
            <div className="d-flex justify-content-center flex-column align-items-center">
              {/* <Logo size={32} variant="default" /> */}
              <span className="fw-semibold small text-jjjei-primary">Juan Jamora, Jr. Enterprises Inc.</span>
            </div>
              <span className="fw-normal text-muted small">{systemInfo.name} {systemInfo.version}</span>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
