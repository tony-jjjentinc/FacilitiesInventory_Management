import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser, logout } from './services/auth';
import type { UserClaims } from './types';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/DashboardOverview';
import { MasterCatalog } from './pages/MasterCatalog';
import { WarehouseStock } from './pages/WarehouseStock';
import { RopAlertCenter } from './pages/RopAlertCenter';
import { ApprovalsQueue } from './pages/ApprovalsQueue';
import { Configuration } from './pages/Configuration';
import { Transactions } from './pages/Transactions';
import { WarehouseReceiving } from './pages/WarehouseReceiving';
import { useSystemInfo } from './context/SystemContext';
import { Logo } from './components/Logo';

export const App: React.FC = () => {
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

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  const isHeadOrAdmin = currentUser?.roles?.some(r =>
    ['Super Admin', 'Head'].includes(r.trim())
  );

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
        />

        <main className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<DashboardOverview />} />
            <Route path="/catalog" element={<MasterCatalog />} />
            <Route path="/warehouse" element={<WarehouseStock />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/receiving" element={<WarehouseReceiving />} />
            <Route path="/alerts" element={<RopAlertCenter />} />

            {/* Role Guarded Routes for Head/Admin */}
            <Route
              path="/approvals"
              element={isHeadOrAdmin ? <ApprovalsQueue /> : <Navigate to="/overview" replace />}
            />
            <Route
              path="/configuration"
              element={
                isHeadOrAdmin ? (
                  <Navigate to="/configuration/item" replace />
                ) : (
                  <Navigate to="/overview" replace />
                )
              }
            />
            <Route
              path="/configuration/:subTab"
              element={isHeadOrAdmin ? <Configuration /> : <Navigate to="/overview" replace />}
            />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>

        <footer className="py-3 text-center small text-muted mt-auto">
          <div className="container-fluid d-flex flex-column flex-md-row justify-content-center justify-content-md-between align-items-center px-3">
            <div className="">
              <Logo size={32} variant="default" />
            </div>
            <span className="fw-light">{systemInfo.name} {systemInfo.version}</span>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
