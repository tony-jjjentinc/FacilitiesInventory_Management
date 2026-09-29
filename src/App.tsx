import React, { useState, useEffect } from 'react';
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

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserClaims | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('overview');
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
        if (!updatedUser) {
          setCurrentTab('overview');
        }
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
    setCurrentTab('overview');
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
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={currentUser}
        onLogout={handleLogout}
      />

      <main className="flex-grow-1">
        {currentTab === 'overview' && <DashboardOverview onNavigate={setCurrentTab} />}
        {currentTab === 'catalog' && <MasterCatalog />}
        {currentTab === 'warehouse' && <WarehouseStock />}
        {currentTab === 'alerts' && <RopAlertCenter />}
        {currentTab === 'approvals' && isHeadOrAdmin && <ApprovalsQueue />}
        {currentTab === 'config' && isHeadOrAdmin && <Configuration />}
      </main>

      <footer className="bg-white border-top py-3 text-center small text-muted mt-auto">
        <div className="container">
          Juan Jamora Jr. Enterprises, Inc. (JJJEI) • Facilities Department &copy; 2026. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default App;
