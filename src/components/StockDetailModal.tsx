import React from 'react';
import { Link } from 'react-router-dom';
import type { WarehouseStockItem } from '../types';
import { entityPath } from './entity/entityPaths';
import { fmtDate, fmtDateTime } from '../utils/datetime';
import { peso } from '../utils/format';

interface Props {
  row: WarehouseStockItem;
  showCosts: boolean;
  onTrace: () => void;
  onClose: () => void;
}

const day = (v?: string) => fmtDate(v, '—');
const STATUS: Record<string, { text: string; cls: string }> = {
  NORMAL: { text: 'Normal', cls: 'bg-success-subtle text-success' },
  REORDER_WARNING: { text: 'Reorder warning', cls: 'bg-warning-subtle text-warning-emphasis' },
  CRITICAL_DEPLETION: { text: 'Critical', cls: 'bg-danger-subtle text-danger' }
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="col-6">
    <div className="text-muted text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>{label}</div>
    <div className="small text-break">{children}</div>
  </div>
);

/** Everything known about one stock line: the card shows the headline, this shows the rest. */
export const StockDetailModal: React.FC<Props> = ({ row, showCosts, onTrace, onClose }) => {
  const st = STATUS[row.ROP_Status] || STATUS.NORMAL;
  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-content border shadow-sm" style={{ borderRadius: '8px' }}>
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div className="min-w-0">
              <h6 className="modal-title fw-bold text-dark mb-0">{row.Item_Name}</h6>
              <div className="small text-muted">{row.Item_SKU}{row.Classification ? ` · ${row.Classification}` : ''}</div>
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            <div className="d-flex align-items-end justify-content-between mb-3">
              <div><span className="fs-3 fw-semibold text-dark lh-1">{row.On_Hand_Qty}</span> <span className="text-muted">{row.UOM} on hand</span></div>
              <span className={`badge ${st.cls} border`}>{st.text}</span>
            </div>
            <div className="row g-3">
              <Field label="System">{row.System || '—'}</Field>
              <Field label="Component">{row.Component || '—'}</Field>
              <Field label="Warehouse"><Link to={entityPath('WAREHOUSE', row.Warehouse_Location)} className="text-decoration-none" onClick={onClose}>{row.Warehouse_Name || row.Warehouse_Location}</Link></Field>
              <Field label="Area">{row.Area_ID ? <Link to={entityPath('AREA', row.Area_ID)} className="text-decoration-none" onClick={onClose}>{row.Area_Name || row.Area_ID}</Link> : '—'}</Field>
              {showCosts && <Field label="Unit cost (average)">{peso(row.Unit_Cost)}</Field>}
              {showCosts && <Field label="Total value">{peso(row.Valuation)}</Field>}
              <Field label="First received">{day(row.First_Received_At)}</Field>
              <Field label="Last issued">{day(row.Last_Issued_At)}</Field>
              {row.Serial_Number && <Field label="Serial number">{row.Serial_Number}</Field>}
              <Field label="Last updated">{fmtDateTime(row.Last_Updated, '—')}</Field>
              <Field label="Stock line"><span className="font-monospace">{row.Inventory_ID}</span></Field>
              <Field label="Item">
                <Link to={entityPath('ITEM', row.Item_ID)} className="text-decoration-none" onClick={onClose}>Open item page</Link>
              </Field>
            </div>
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { onClose(); onTrace(); }}>View trace</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};
