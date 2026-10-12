import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationItem } from '../types';
import { apiRequest, DATA_CHANGED_EVENT } from '../services/api';

interface NotificationBellProps {
  onNavigate: (route: string) => void;
  onLoaded?: (items: NotificationItem[]) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate, onLoaded }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const onLoadedRef = useRef(onLoaded); // the poll below must not restart when the parent passes a new callback
  useEffect(() => { onLoadedRef.current = onLoaded; });

  // close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [isOpen]);

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await apiRequest<NotificationItem[]>('notifications:get');
      if (Array.isArray(data)) {
        setNotifications(data);
        onLoadedRef.current?.(data);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  // Poll every 2 minutes, but only while this tab is on screen; refresh at once when the user comes back to it
  // (after more than 30 seconds away), so a background tab costs the server nothing and a returning user never sees old counts.
  useEffect(() => {
    let last = 0;
    const load = () => { last = Date.now(); fetchNotifs(); };
    load();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 120000);
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last > 30000) load(); };
    // the user's own writes (a receipt confirmed, an incident approved...) refresh the counts after a short pause
    let pause: ReturnType<typeof setTimeout> | undefined;
    const onChanged = () => { clearTimeout(pause); pause = setTimeout(load, 1500); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener(DATA_CHANGED_EVENT, onChanged);
    return () => {
      clearInterval(interval); clearTimeout(pause);
      document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); window.removeEventListener(DATA_CHANGED_EVENT, onChanged);
    };
  }, [fetchNotifs]);

  const totalCount = notifications.reduce((acc, curr) => acc + (curr.count || 1), 0);
  const hasDanger = notifications.some(n => n.severity === 'DANGER');

  return (
    <div className="position-relative" ref={rootRef}>
      <button
        type="button"
        className="btn btn-sm position-relative d-flex align-items-center justify-content-center"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <i className="bi bi-bell fs-6"></i>
        {totalCount > 0 && (
          <span
            className={`position-absolute top-0 start-100 translate-middle badge rounded-pill ${
              hasDanger ? 'bg-danger' : 'bg-warning text-dark'
            }`}
            style={{ fontSize: '0.65rem' }}
          >
            {totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="dropdown-menu dropdown-menu-end show shadow-sm p-0 border"
          style={{ width: '320px', position: 'absolute', right: 0, top: '100%', zIndex: 1050, marginTop: '8px' }}
        >
          <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
            <span className="fw-semibold small text-dark">Notifications</span>
            <span className="badge bg-secondary">{notifications.length}</span>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                No active notifications.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-2 px-3 border-bottom cursor-pointer"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate(notif.route);
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span
                      className={`badge ${
                        notif.severity === 'DANGER'
                          ? 'bg-danger'
                          : notif.severity === 'WARNING'
                          ? 'bg-warning text-dark'
                          : 'bg-light text-dark border'
                      }`}
                      style={{ fontSize: '0.7rem' }}
                    >
                      {notif.category}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {notif.count ? `${notif.count} items` : ''}
                    </span>
                  </div>
                  <div className="fw-medium small text-dark">{notif.title}</div>
                  <div className="small text-muted">{notif.message}</div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-top bg-light text-center">
            <button
              className="btn btn-link btn-sm text-decoration-none py-0 text-muted"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
