import React, { useState } from 'react';
import type { UserClaims } from '../types';
import { NotificationBell } from './NotificationBell';
import { Logo } from './Logo';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: UserClaims | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, user, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHeadOrAdmin = user?.roles?.some(r =>
    ['Super Admin', 'Head'].includes(r.trim())
  );

  const navItems = [
    { id: 'overview', label: 'Dashboard' },
    { id: 'catalog', label: 'Master Catalog' },
    { id: 'warehouse', label: 'Warehouse Stock' },
    { id: 'alerts', label: 'ROP Alerts' },
    ...(isHeadOrAdmin
      ? [
          { id: 'approvals', label: 'Approvals' },
          { id: 'rollover', label: 'Fiscal Rollover' }
        ]
      : [])
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    setMobileOpen(false);
  };

  return (
    <>
      <header className="bg-white border-bottom sticky-top py-2 px-3">
        <div className="container-fluid d-flex align-items-center justify-content-between">
          {/* Left: Mobile Toggle & Brand */}
          <div className="d-flex align-items-center gap-3">
            <button
              className="btn btn-sm btn-outline-secondary d-lg-none"
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              <i className="bi bi-list fs-5"></i>
            </button>

            <div
              className="d-flex align-items-center gap-2 cursor-pointer"
              onClick={() => handleNavClick('overview')}
            >
              <Logo size={28} />
              <div>
                <span className="fw-bold d-block lh-1 text-dark" style={{ fontSize: '0.95rem' }}>
                  Facilities Inventory
                </span>
                <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                  JJJEI Management Portal
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="d-none d-lg-flex align-items-center gap-1 ms-4">
              {navItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`btn btn-sm ${
                      isActive
                        ? 'btn-dark fw-medium'
                        : 'btn-link text-secondary text-decoration-none'
                    }`}
                    style={
                      isActive
                        ? { backgroundColor: '#0f172a', borderColor: '#0f172a' }
                        : { fontSize: '0.875rem' }
                    }
                    onClick={() => handleNavClick(item.id)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: Notifications & User profile */}
          <div className="d-flex align-items-center gap-3">
            <NotificationBell onNavigate={(route) => handleNavClick(route.replace('/', ''))} />

            {user && (
              <div className="d-flex align-items-center gap-2 border-start ps-3">
                <div className="text-end d-none d-sm-block">
                  <div className="fw-semibold text-dark lh-sm" style={{ fontSize: '0.825rem' }}>
                    {user.name}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.725rem' }}>
                    {user.roles?.[0] || 'User'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={onLogout}
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer / Sidebar */}
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <Logo size={24} />
            <span className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>Facilities Inventory</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          ></button>
        </div>

        <div className="p-3 flex-grow-1 overflow-auto">
          <div className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
            Navigation
          </div>
          <div className="d-flex flex-column gap-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`btn text-start btn-sm py-2 px-3 ${
                    isActive ? 'btn-dark fw-medium' : 'btn-light text-dark'
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: '#0f172a', borderColor: '#0f172a' }
                      : {}
                  }
                  onClick={() => handleNavClick(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {user && (
            <div className="mt-4 pt-3 border-top">
              <div className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                Signed In User
              </div>
              <div className="p-2 bg-light rounded mb-2">
                <div className="fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>{user.name}</div>
                <div className="text-muted small">{user.email}</div>
                <span className="badge bg-secondary-subtle text-secondary border mt-1">
                  {user.roles?.[0] || 'User'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm w-100"
                onClick={onLogout}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
