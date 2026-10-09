import React, { useState } from 'react';
import type { LinePriceSource, ReceivingLine } from '../../types';
import { withTypedCost } from './receivingUtils';

interface Props {
  line: ReceivingLine;
  onChange: (line: ReceivingLine) => void;
}

const BADGE: Record<LinePriceSource | 'PENDING', { cls: string; text: string }> = {
  SUPPLIER: { cls: 'bg-success-subtle text-success border', text: 'Supplier price' },
  BASE: { cls: 'bg-info-subtle text-info border', text: 'Base price' },
  NEW_BASE: { cls: 'bg-primary-subtle text-primary border', text: 'Saves as base price' },
  CUSTOM: { cls: 'bg-secondary-subtle text-secondary border', text: 'Custom price' },
  NONE: { cls: 'bg-warning-subtle text-warning-emphasis border', text: 'No price' },
  PENDING: { cls: 'bg-warning-subtle text-warning-emphasis border', text: 'To be priced' }
};

/** One cell for the unit cost, where it came from, and the "update price source" action. */
export const PriceCell: React.FC<Props> = ({ line, onChange }) => {
  const [open, setOpen] = useState(false);
  const cost = line.unitCost.trim() === '' ? 0 : Number(line.unitCost);
  const badge = cost === 0 ? BADGE.PENDING : BADGE[line.priceSource];

  return (
    <div style={{ minWidth: '190px' }}>
      <div className="input-group input-group-sm">
        <span className="input-group-text">₱</span>
        <input
          type="number" min="0" step="0.01" className="form-control" aria-label="Unit cost"
          value={line.unitCost}
          onChange={e => onChange(withTypedCost(line, e.target.value))}
        />
      </div>
      <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
        <span className={`badge ${badge.cls}`} style={{ fontSize: '0.65rem' }}>{badge.text}</span>
        <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" style={{ fontSize: '0.72rem' }}
          onClick={() => setOpen(true)}>
          Update price source
        </button>
      </div>
      {open && <PriceSourceModal line={line} onClose={() => setOpen(false)} onApply={l => { onChange(l); setOpen(false); }} />}
    </div>
  );
};

type Choice = string; // 'SUPPLIER:<id>' | 'BASE' | 'CUSTOM'

const PriceSourceModal: React.FC<{ line: ReceivingLine; onClose: () => void; onApply: (l: ReceivingLine) => void }> = ({ line, onClose, onApply }) => {
  const suppliers = line.priceOptions.filter(o => o.source === 'SUPPLIER');
  const base = line.priceOptions.find(o => o.source === 'BASE');
  const initial: Choice =
    line.priceSource === 'BASE' || line.priceSource === 'NEW_BASE' ? 'BASE'
      : line.priceSource === 'SUPPLIER' ? `SUPPLIER:${suppliers.find(o => o.unitCost === line.originalCost)?.supplierId || suppliers[0]?.supplierId}`
        : line.priceSource === 'CUSTOM' ? 'CUSTOM' : (suppliers.length ? `SUPPLIER:${suppliers[0].supplierId}` : 'BASE');
  const [choice, setChoice] = useState<Choice>(initial);
  const [baseValue, setBaseValue] = useState(base ? String(base.unitCost) : (line.priceSource === 'NEW_BASE' ? line.unitCost : ''));
  const [customValue, setCustomValue] = useState(line.unitCost);

  const baseNum = Number(baseValue);
  const baseChanged = !base || baseNum !== base.unitCost;
  const valid = choice === 'BASE' ? baseNum > 0 : choice === 'CUSTOM' ? Number(customValue) > 0 : true;

  const apply = () => {
    if (choice.startsWith('SUPPLIER:')) {
      const opt = suppliers.find(o => `SUPPLIER:${o.supplierId}` === choice);
      if (!opt) return;
      onApply({ ...line, unitCost: String(opt.unitCost), priceSource: 'SUPPLIER', saveAsBasePrice: false });
    } else if (choice === 'BASE') {
      onApply({ ...line, unitCost: String(baseNum), priceSource: baseChanged ? 'NEW_BASE' : 'BASE', saveAsBasePrice: baseChanged });
    } else {
      onApply({ ...line, unitCost: customValue, priceSource: 'CUSTOM', saveAsBasePrice: false });
    }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1065 }}>
      <div className="modal-dialog">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">Update price source</h6>
              <div className="small text-muted"><span className="font-monospace">{line.itemId}</span> — {line.itemName}</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 small">
            {suppliers.map(o => (
              <label key={o.supplierId} className="d-flex align-items-center gap-2 mb-2">
                <input type="radio" className="form-check-input mt-0" checked={choice === `SUPPLIER:${o.supplierId}`} onChange={() => setChoice(`SUPPLIER:${o.supplierId}`)} />
                <span className="flex-grow-1">{o.supplierName || o.supplierId}{o.preferred ? <span className="badge bg-success-subtle text-success border ms-2">preferred</span> : null}</span>
                <span className="fw-semibold">₱{o.unitCost.toFixed(2)}</span>
              </label>
            ))}
            {suppliers.length === 0 && <div className="text-muted mb-2">No supplier has a price for this item.</div>}

            <label className="d-flex align-items-center gap-2 mb-1 mt-3">
              <input type="radio" className="form-check-input mt-0" checked={choice === 'BASE'} onChange={() => setChoice('BASE')} />
              <span className="flex-grow-1">Base price {base ? '' : '(none yet)'}</span>
              {base && <span className="fw-semibold">₱{base.unitCost.toFixed(2)}</span>}
            </label>
            {choice === 'BASE' && (
              <div className="ms-4 mb-2">
                <div className="input-group input-group-sm" style={{ maxWidth: '200px' }}>
                  <span className="input-group-text">₱</span>
                  <input type="number" min="0" step="0.01" className="form-control" value={baseValue} onChange={e => setBaseValue(e.target.value)} />
                </div>
                <div className="form-text">{baseChanged ? (base ? 'Saves this as the new base price for the item.' : 'Saves this as the item\'s first base price.') : 'Keeps the current base price.'}</div>
              </div>
            )}

            <label className="d-flex align-items-center gap-2 mb-1 mt-3">
              <input type="radio" className="form-check-input mt-0" checked={choice === 'CUSTOM'} onChange={() => setChoice('CUSTOM')} />
              <span className="flex-grow-1">Custom price for this receipt only</span>
            </label>
            {choice === 'CUSTOM' && (
              <div className="ms-4">
                <div className="input-group input-group-sm" style={{ maxWidth: '200px' }}>
                  <span className="input-group-text">₱</span>
                  <input type="number" min="0" step="0.01" className="form-control" value={customValue} onChange={e => setCustomValue(e.target.value)} />
                </div>
                <div className="form-text">Not saved anywhere else.</div>
              </div>
            )}
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={!valid}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
};
