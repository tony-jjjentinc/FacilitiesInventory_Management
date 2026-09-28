import React, { useEffect, useState } from 'react';
import type { NotificationItem } from '../types';
import { apiRequest } from '../services/api';

interface NotificationBellProps {
  onNavigate: (route: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifs = async () => {
    try {
      const data = await apiRequest<NotificationItem[]>('notifications:get');
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalCount = notifications.reduce((acc, curr) => acc + (curr.count || 1), 0);
  const hasDanger = notifications.some(n => n.severity === 'DANGER');

  return (
    <div className="position-relative">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm position-relative d-flex align-items-center justify-content-center"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        style={{ width: '34px', height: '31px', padding: 0 }}
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
