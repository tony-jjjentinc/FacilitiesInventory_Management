import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MenuAction {
  key: string;
  label: string;
  onClick: () => void;
  hidden?: boolean;
  danger?: boolean;
  /** shown as a tooltip */
  hint?: string;
}

/**
 * Three-dots button with a dropdown of row actions. The menu is drawn on the page body (fixed position),
 * so scrolling tables do not clip it. Closes on outside click, Escape, scroll and resize.
 */
export const ActionMenu: React.FC<{ actions: MenuAction[]; label?: string }> = ({ actions, label = 'Actions' }) => {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = actions.filter(a => !a.hidden);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  if (items.length === 0) return null;

  const toggle = () => {
    if (pos) { setPos(null); return; }
    const r = btnRef.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  };

  return (
    <>
      <button ref={btnRef} type="button" className="btn btn-secondary btn-sm d-inline-flex align-items-center justify-content-center"
        style={{ width: '32px', height: '28px', padding: 0 }} title={label} aria-label={label} aria-haspopup="menu" aria-expanded={!!pos} onClick={toggle}>
        <i className="bi bi-three-dots"></i>
      </button>
      {pos && createPortal(
        <div ref={menuRef} role="menu" className="dropdown-menu show shadow-sm border py-1" style={{ position: 'fixed', top: pos.top, right: pos.right, left: 'auto', zIndex: 1080, minWidth: '190px', fontSize: '0.85rem' }}>
          {items.map(a => (
            <button key={a.key} type="button" role="menuitem" title={a.hint}
              className={`dropdown-item ${a.danger ? 'text-danger' : ''}`}
              onClick={() => { setPos(null); a.onClick(); }}>
              {a.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
