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
    { id: 'overview', label: 'Dashboard', icon: 'bi-grid-1x2' },
    { id: 'catalog', label: 'Master Catalog', icon: 'bi-box-seam' },
    { id: 'warehouse', label: 'Warehouse Stock', icon: 'bi-buildings' },
    { id: 'alerts', label: 'ROP Alerts', icon: 'bi-exclamation-triangle' },
    ...(isHeadOrAdmin
      ? [
          { id: 'approvals', label: 'Approvals', icon: 'bi-clipboard-check' },
          { id: 'config', label: 'Configuration', icon: 'bi-sliders' }
        ]
      : [])
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    setMobileOpen(false);
  };

  // Extract initials for the avatar badge
  const userInitials = (user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');

  return (
    <>
      <header className="bg-white border-bottom sticky-top py-2 px-3">
        <div className="container-fluid d-flex align-items-center justify-content-between">
          {/* Left Section: Mobile Toggle, Brand Logo, System Name, Version Badge */}
          <div className="d-flex align-items-center gap-2" style={{ minWidth: '260px' }}>
            <button
              className="btn btn-sm btn-outline-secondary d-lg-none me-1"
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              <i className="bi bi-list fs-5"></i>
            </button>

            <div
              className="d-flex align-items-center gap-2 cursor-pointer"
              onClick={() => handleNavClick('overview')}
              title="Return to Dashboard Overview"
            >
              <Logo size={28} />
              <div className="d-flex flex-column">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold lh-1 text-dark" style={{ fontSize: '0.925rem', letterSpacing: '-0.01em' }}>
                    Facilities Inventory
                  </span>
                  <span className="badge bg-secondary-subtle text-secondary border px-1 py-0" style={{ fontSize: '0.65rem' }}>
                    v1.0.0
                  </span>
                </div>
                <span className="text-muted small" style={{ fontSize: '0.72rem', marginTop: '1px' }}>
                  Management Dashboard
                </span>
              </div>
            </div>
          </div>

          {/* Center Section: Navigation Options (Desktop) */}
          <nav className="d-none d-lg-flex align-items-center justify-content-center gap-1 flex-grow-1 mx-3" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-tab-link ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Section: Notifications & Account Profile */}
          <div className="d-flex align-items-center justify-content-end gap-2" style={{ minWidth: '240px' }}>
            <NotificationBell onNavigate={(route) => handleNavClick(route.replace('/', ''))} />

            {user && (
              <div className="d-flex align-items-center gap-2 border-start ps-2 ms-1">
                {/* User Avatar & Details */}
                <div className="d-flex align-items-center gap-2">
                  <div className="user-avatar-badge" title={user.name}>
                    {userInitials}
                  </div>
                  <div className="d-none d-xl-block text-start lh-sm">
                    <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.8rem', maxWidth: '140px' }} title={user.name}>
                      {user.name}
                    </div>
                    <div className="text-muted text-truncate" style={{ fontSize: '0.7rem', maxWidth: '140px' }}>
                      {user.roles?.[0] || 'User'}
                    </div>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm ms-1 py-1 px-2"
                  onClick={onLogout}
                  title="Sign Out"
                  style={{ height: '32px' }}
                >
                  <i className="bi bi-box-arrow-right"></i>
                  <span className="d-none d-md-inline ms-1" style={{ fontSize: '0.75rem' }}>Sign Out</span>
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
        {/* Drawer Header */}
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-light">
          <div className="d-flex align-items-center gap-2">
            <Logo size={26} />
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold text-dark lh-1" style={{ fontSize: '0.875rem' }}>
                  Facilities Inventory
                </span>
                <span className="badge bg-secondary-subtle text-secondary border px-1 py-0" style={{ fontSize: '0.62rem' }}>
                  v1.0.0
                </span>
              </div>
              <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                Management Dashboard
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-close btn-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          ></button>
        </div>

        {/* Drawer Navigation Body */}
        <div className="p-3 flex-grow-1 overflow-auto d-flex flex-column justify-content-between">
          <div>
            <div className="text-uppercase text-muted fw-bold mb-2 px-2" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
              Main Navigation
            </div>
            <div className="d-flex flex-column gap-1">
              {navItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`btn text-start btn-sm py-2 px-3 d-flex align-items-center gap-2 border-0 ${
                      isActive
                        ? 'btn-primary fw-medium'
                        : 'btn-light text-dark'
                    }`}
                    style={{ borderRadius: '6px', fontSize: '0.85rem' }}
                    onClick={() => handleNavClick(item.id)}
                  >
                    <i className={`bi ${item.icon} ${isActive ? 'text-white' : 'text-secondary'}`}></i>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drawer User & Footer Section */}
          {user && (
            <div className="mt-4 pt-3 border-top">
              <div className="d-flex align-items-center gap-2 p-2 bg-light rounded mb-3 border">
                <div className="user-avatar-badge">
                  {userInitials}
                </div>
                <div className="lh-sm overflow-hidden flex-grow-1">
                  <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.825rem' }}>
                    {user.name}
                  </div>
                  <div className="text-muted small text-truncate" style={{ fontSize: '0.72rem' }}>
                    {user.email}
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary border px-1 py-0 mt-1" style={{ fontSize: '0.65rem' }}>
                    {user.roles?.[0] || 'User'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2 py-2"
                onClick={onLogout}
              >
                <i className="bi bi-box-arrow-right"></i>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
