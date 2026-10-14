import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { UserClaims } from '../types';
import { isUserHeadOrAdmin } from '../services/auth';
import { DELIVERIES_COUNT_EVENT } from '../services/api';
import { getAccess } from '../services/access';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { Logo } from './Logo';
import { useSystemInfo } from '../context/SystemContext';

interface NavbarProps {
  user: UserClaims | null;
  onLogout: () => void;
  onFeed?: (counts: { receipts: number; approvals: number }) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onFeed }) => {
  const [counts, setCounts] = useState({ receipts: 0, approvals: 0 });
  // exact counts from the Deliveries page once it has loaded; until then the bell feed's number is used
  const [live, setLive] = useState<{ tasks: number; pending: number } | null>(null);
  const { systemInfo } = useSystemInfo();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/Cmd+K opens the general search from any page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const access = getAccess(user);
  const canSeeAnalytics = access.canSeeAnalytics;

  const navItems: { id: string; path: string; label: string; badge?: number }[] = [
    { id: 'overview', path: '/overview', label: 'Dashboard' },
    { id: 'inventory', path: '/inventory', label: 'Inventory' },
    ...(access.canField ? [{ id: 'deliveries', path: '/deliveries', label: 'Deliveries', badge: live ? live.tasks + live.pending : counts.receipts }] : []),
    { id: 'activities', path: '/activities', label: 'Projects & Activities' },
    ...(canSeeAnalytics ? [{ id: 'analytics', path: '/analytics', label: 'Analytics' }] : []),
    ...(isHeadOrAdmin ? [{ id: 'admin', path: '/admin', label: 'Admin', badge: counts.approvals }, { id: 'configuration', path: '/configuration', label: 'Configuration' }] : [])
  ];

  const isItemActive = (item: { id: string; path: string }) =>
    location.pathname === item.path || location.pathname.startsWith(item.path + '/') || (item.id === 'overview' && location.pathname === '/');

  // the confirmation list knows the exact count the moment it changes; the bell feed catches up later
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent).detail || {}; setLive({ tasks: Number(d.tasks) || 0, pending: Number(d.pending) || 0 }); };
    window.addEventListener(DELIVERIES_COUNT_EVENT, on);
    return () => window.removeEventListener(DELIVERIES_COUNT_EVENT, on);
  }, []);

  const handleFeed = (items: { id: string; count?: number }[]) => {
    const next = {
      receipts: items.find(n => n.id === 'NOTIF_RECEIPTS_AWAITING')?.count || 0,
      approvals: items.find(n => n.id === 'NOTIF_PENDING_INCIDENTS')?.count || 0
    };
    setCounts(next);
    onFeed?.(next);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    setAccountMenuOpen(false);
  };

  // accounts without a directory name carry their email as the name: show the part before the @
  const displayName = (user?.name || '').split('@')[0];

  // Extract initials for the avatar badge
  const userInitials = (displayName || 'U')
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
                </div>
                <span
                  className="text-muted d-block"
                  style={{ fontSize: "0.7rem", marginTop: "0px" }}
                >
                  {systemInfo.subtitle}
                </span>
              </div>
            </div>
          </div>

          {/* Center Section: Navigation Options (Desktop) */}
          <nav className="d-none d-lg-flex justify-content-center flex-grow-1 mx-2" aria-label="Main Navigation">
            <ul className="nav nav-pills nav-pills-sm gap-1">
              {navItems.map((item) => {
                const isActive = isItemActive(item);
                return (
                  <li key={item.id} className="nav-item">
                    <button
                      type="button"
                      className={`nav-link ${isActive ? "active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => handleNavClick(item.path)}
                    >
                      <span>{item.label}</span>
                      {item.badge ? <span className="badge rounded-pill bg-danger ms-2">{item.badge}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Right Section: Search, Notifications & Account Profile */}
          <div
            className="d-flex align-items-center justify-content-end gap-1 gap-sm-2"
            style={{ flexShrink: 0 }}
          >
            {user && (
              <>
                <button type="button" className="btn btn-sm d-flex align-items-center justify-content-center" onClick={() => setSearchOpen(true)}
                  title="Search (Ctrl+K)" aria-label="Search">
                  <i className="bi bi-search fs-6"></i>
                </button>
                <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
              </>
            )}

            <NotificationBell
              onLoaded={handleFeed}
              onNavigate={(route) => {
                const target = route.startsWith('/') ? route : `/${route}`;
                handleNavClick(target);
              }}
            />
            {user && (
              <div className="position-relative" ref={accountMenuRef}>
                {/* Account Profile Trigger Button */}
                <button
                  type="button"
                  className={`user-profile-trigger d-flex align-items-center gap-2 ${accountMenuOpen ? "active" : ""}`}
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  aria-expanded={accountMenuOpen}
                  aria-label="User account menu"
                  title={`${displayName} (${user.roles?.[0] || "User"})`}
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
                      {displayName}
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
                            {displayName}
                          </div>
                          <div
                            className="text-muted small text-truncate"
                            style={{ fontSize: "0.72rem" }}
                          >
                            {user.email}
                          </div>
                        </div>
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
                const isActive = isItemActive(item);
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
                    {item.badge ? <span className="badge rounded-pill bg-danger ms-auto">{item.badge}</span> : null}
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
                    {displayName}
                  </div>
                  <div
                    className="text-muted small text-truncate"
                    style={{ fontSize: "0.72rem" }}
                  >
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2 py-2"
                onClick={onLogout}
              >
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
