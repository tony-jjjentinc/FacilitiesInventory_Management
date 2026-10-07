import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { UserClaims } from '../types';
import { isUserHeadOrAdmin } from '../services/auth';
import { NotificationBell } from './NotificationBell';
import { Logo } from './Logo';
import { useSystemInfo } from '../context/SystemContext';

interface NavbarProps {
  user: UserClaims | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const { systemInfo } = useSystemInfo();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Close account dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    if (accountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [accountMenuOpen]);

  const isHeadOrAdmin = isUserHeadOrAdmin(user);

  const navItems = [
    { id: 'overview', path: '/overview', label: 'Dashboard', icon: 'bi-grid-1x2' },
    { id: 'catalog', path: '/catalog', label: 'Master Catalog', icon: 'bi-box-seam' },
    { id: 'warehouse', path: '/warehouse', label: 'Warehouse Stock', icon: 'bi-buildings' },
    { id: 'allocation', path: '/allocation', label: 'Project Allocation', icon: 'bi-diagram-3' },
    { id: 'custody', path: '/custody', label: 'Tool Custody', icon: 'bi-person-badge' },
    { id: 'transactions', path: '/transactions', label: 'Transactions', icon: 'bi-journal-text' },
    { id: 'receiving', path: '/receiving', label: 'Receiving', icon: 'bi-box-arrow-in-down' },
    { id: 'alerts', path: '/alerts', label: 'ROP Alerts', icon: 'bi-exclamation-triangle' },
    ...(isHeadOrAdmin
      ? [
          { id: 'approvals', path: '/approvals', label: 'Approvals', icon: 'bi-clipboard-check' },
          { id: 'configuration', path: '/configuration/item', label: 'Configuration', icon: 'bi-sliders' }
        ]
      : [])
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    setAccountMenuOpen(false);
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
      <header className="bg-white border-bottom sticky-top py-2 px-2 px-md-3">
        <div className="container-fluid d-flex align-items-center justify-content-between p-0">
          {/* Left Section: Mobile Toggle, Brand Logo, System Name, Version Badge */}
          <div
            className="d-flex align-items-center gap-2"
            style={{ flexShrink: 0 }}
          >
            <button
              className="btn btn-sm btn-outline-secondary d-lg-none p-1 border-0"
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              <i className="bi bi-list fs-4 text-dark"></i>
            </button>

            <div
              className="d-flex align-items-center gap-2 cursor-pointer"
              onClick={() => handleNavClick("/overview")}
              title="Return to Dashboard Overview"
            >
              <Logo size={28} />
              <div className="d-flex flex-column">
                <div className="d-flex align-items-center gap-1 gap-sm-2 flex-wrap">
                  <span
                    className="fw-bold lh-1 text-dark"
                    style={{ fontSize: "0.9rem", letterSpacing: "-0.01em" }}
                  >
                    {systemInfo.shortName}
                  </span>
                  <span
                    className="badge bg-secondary-subtle text-secondary border px-1 py-0 d-none d-sm-inline"
                    style={{ fontSize: "0.62rem" }}
                  >
                    {systemInfo.version}
                  </span>
                </div>
                <span
                  className="text-muted d-block"
                  style={{ fontSize: "0.7rem", marginTop: "2px" }}
                >
                  {systemInfo.subtitle}
                </span>
              </div>
            </div>
          </div>

          {/* Center Section: Navigation Options (Desktop) */}
          <nav
            className="d-none d-lg-flex align-items-center justify-content-center gap-1 flex-grow-1 mx-2"
            aria-label="Main Navigation"
          >
            {navItems.map((item) => {
              const isActive =
                item.id === 'configuration'
                  ? location.pathname.startsWith('/configuration')
                  : location.pathname === item.path || (item.id === 'overview' && location.pathname === '/');
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-tab-link ${isActive ? "active" : ""}`}
                  onClick={() => handleNavClick(item.path)}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Section: Notifications & Account Profile */}
          <div
            className="d-flex align-items-center justify-content-end gap-1 gap-sm-2"
            style={{ flexShrink: 0 }}
          >
            <NotificationBell
              onNavigate={(route) => {
                const target = route.startsWith('/') ? route : `/${route}`;
                handleNavClick(target);
              }}
            />

            {user && (
              <div className="position-relative ms-1" ref={accountMenuRef}>
                {/* Account Profile Trigger Button */}
                <button
                  type="button"
                  className={`user-profile-trigger d-flex align-items-center gap-2 ${accountMenuOpen ? "active" : ""}`}
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  aria-expanded={accountMenuOpen}
                  aria-label="User account menu"
                  title={`${user.name} (${user.roles?.[0] || "User"})`}
                >
                  <div className="user-avatar-badge">{userInitials}</div>
                  <div
                    className="d-none d-md-block text-start lh-sm"
                    style={{ maxWidth: "130px" }}
                  >
                    <div
                      className="fw-semibold text-dark text-truncate"
                      style={{ fontSize: "0.78rem" }}
                    >
                      {user.name}
                    </div>
                    <div
                      className="text-muted text-truncate"
                      style={{ fontSize: "0.68rem" }}
                    >
                      {user.roles?.[0] || "User"}
                    </div>
                  </div>
                  <i
                    className={`bi bi-chevron-down text-muted small d-none d-md-inline transition-all ${accountMenuOpen ? "rotate-180" : ""}`}
                    style={{ fontSize: "0.7rem" }}
                  ></i>
                </button>

                {/* Floating Account Dropdown Menu */}
                {accountMenuOpen && (
                  <div
                    className="dropdown-menu show shadow-lg border p-0 position-absolute end-0 mt-2"
                    style={{
                      width: "260px",
                      zIndex: 1060,
                      borderRadius: "8px",
                      animation: "fadeIn 0.15s ease-out",
                    }}
                  >
                    {/* User Profile Summary Header */}
                    <div className="p-3 bg-light rounded-top border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="user-avatar-badge"
                          style={{
                            width: "38px",
                            height: "38px",
                            fontSize: "0.9rem",
                          }}
                        >
                          {userInitials}
                        </div>
                        <div className="lh-sm overflow-hidden flex-grow-1">
                          <div
                            className="fw-bold text-dark text-truncate"
                            style={{ fontSize: "0.85rem" }}
                          >
                            {user.name}
                          </div>
                          <div
                            className="text-muted small text-truncate"
                            style={{ fontSize: "0.72rem" }}
                          >
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-1 mt-2 flex-wrap">
                        <span
                          className="badge bg-primary-subtle text-primary border"
                          style={{ fontSize: "0.68rem" }}
                        >
                          {user.roles?.[0] || "User"}
                        </span>
                        {user.department && user.department.length > 0 && (
                          <span
                            className="badge bg-light text-secondary border"
                            style={{ fontSize: "0.68rem" }}
                          >
                            {user.department.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions List */}
                    <div className="p-2">
                      <button
                        type="button"
                        className="dropdown-item d-flex align-items-center gap-2 py-2 px-3 rounded text-danger"
                        style={{ fontSize: "0.84rem" }}
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onLogout();
                        }}
                      >
                        <i className="bi bi-box-arrow-right"></i>
                        <span className="fw-medium">Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
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
      <div className={`mobile-drawer ${mobileOpen ? "open" : ""}`}>
        {/* Drawer Header */}
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-light">
          <div className="d-flex flex-column align-items-start gap-2">
            <Logo className="d-block" size={48} />
            <div className="text-start">
              <div
                className="fw-bold text-dark lh-1"
                style={{ fontSize: "0.875rem" }}
              >
                {systemInfo.shortName}
              </div>
              <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                {systemInfo.subtitle} {systemInfo.version}
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
            <div className="d-flex flex-column gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.id === 'configuration'
                    ? location.pathname.startsWith('/configuration')
                    : location.pathname === item.path || (item.id === 'overview' && location.pathname === '/');
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`btn text-start btn-sm py-2 px-3 d-flex align-items-center gap-2 border-0 ${
                      isActive ? "btn-primary fw-medium" : "btn-light text-dark"
                    }`}
                    style={{ borderRadius: "6px", fontSize: "0.85rem" }}
                    onClick={() => handleNavClick(item.path)}
                  >
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
                <div className="user-avatar-badge">{userInitials}</div>
                <div className="lh-sm overflow-hidden flex-grow-1">
                  <div
                    className="fw-semibold text-dark text-truncate"
                    style={{ fontSize: "0.825rem" }}
                  >
                    {user.name}
                  </div>
                  <div
                    className="text-muted small text-truncate"
                    style={{ fontSize: "0.72rem" }}
                  >
                    {user.email}
                  </div>
                  <span
                    className="badge bg-secondary-subtle text-secondary border px-1 py-0 mt-1"
                    style={{ fontSize: "0.65rem" }}
                  >
                    {user.roles?.[0] || "User"}
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
