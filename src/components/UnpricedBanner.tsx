import React from 'react';
import { Link } from 'react-router-dom';
import type { WarehouseStockItem } from '../types';
import { getCurrentUser } from '../services/auth';
import { getAccess } from '../services/access';

/** "3 items unpriced": stock that sits in the warehouse with no unit cost yet. Shown only to accounts that may see costs. */
export const UnpricedBanner: React.FC<{ stock: WarehouseStockItem[] }> = ({ stock }) => {
  const access = getAccess(getCurrentUser());
  const n = stock.filter(r => Number(r.On_Hand_Qty) > 0 && !(Number(r.Unit_Cost) > 0)).length;
  if (!access.canSeeCosts || n === 0) return null;
  return (
    <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 px-3 mb-3 small" role="status">
      <span><i className="bi bi-tag me-2"></i><strong>{n} {n === 1 ? 'item' : 'items'} unpriced.</strong> Their value counts as ₱0.00 until a price is set.</span>
      <Link to={access.isAdmin ? '/admin?tab=price' : '/deliveries?tab=tasks'} className="fw-semibold text-decoration-none">Set prices <i className="bi bi-arrow-right"></i></Link>
    </div>
  );
};
