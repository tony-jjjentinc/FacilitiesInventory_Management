import React, { useEffect, useState } from 'react';
import type { ReceivingLine } from '../../types';

type Choice = string; // 'SUPPLIER:<id>' | 'BASE' | 'CUSTOM'

interface Props {
  line: ReceivingLine;
  /** Called with the line as it would be after the current choice, and whether the choice is complete. */
  onChange: (line: ReceivingLine, valid: boolean) => void;
}

/** Radio list: a supplier price, the item's base price (editable), or a custom price for this receipt only. */
export const PriceChooser: React.FC<Props> = ({ line, onChange }) => {
  const suppliers = line.priceOptions.filter(o => o.source === 'SUPPLIER');
  const base = line.priceOptions.find(o => o.source === 'BASE');
  const initial: Choice =
    line.priceSource === 'BASE' || line.priceSource === 'NEW_BASE' ? 'BASE'
      : line.priceSource === 'SUPPLIER' ? `SUPPLIER:${suppliers.find(o => o.unitCost === line.originalCost)?.supplierId || suppliers[0]?.supplierId}`
        : line.priceSource === 'CUSTOM' ? 'CUSTOM' : (suppliers.length ? `SUPPLIER:${suppliers[0].supplierId}` : 'BASE');
  const [choice, setChoice] = useState<Choice>(initial);
  const [baseValue, setBaseValue] = useState(base ? String(base.unitCost) : (line.priceSource === 'NEW_BASE' ? line.unitCost : ''));
  const [customValue, setCustomValue] = useState(line.priceSource === 'CUSTOM' ? line.unitCost : '');

  const baseNum = Number(baseValue);
  const baseChanged = !base || baseNum !== base.unitCost;

  useEffect(() => {
    if (choice.startsWith('SUPPLIER:')) {
      const opt = suppliers.find(o => `SUPPLIER:${o.supplierId}` === choice);
      if (opt) onChange({ ...line, unitCost: String(opt.unitCost), priceSource: 'SUPPLIER', saveAsBasePrice: false }, true);
    } else if (choice === 'BASE') {
      onChange({ ...line, unitCost: baseValue, priceSource: baseChanged ? 'NEW_BASE' : 'BASE', saveAsBasePrice: baseChanged }, baseNum > 0);
    } else {
      onChange({ ...line, unitCost: customValue, priceSource: 'CUSTOM', saveAsBasePrice: false }, Number(customValue) > 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, baseValue, customValue]);

  return (
    <div className="small">
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
            <input type="number" min="0" step="0.01" className="form-control" aria-label="Base price" value={baseValue} onChange={e => setBaseValue(e.target.value)} />
          </div>
          <div className="form-text">{baseChanged ? (base ? 'Saves this as the new base price for the item.' : "Saves this as the item's first base price.") : 'Keeps the current base price.'}</div>
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
            <input type="number" min="0" step="0.01" className="form-control" aria-label="Custom price" value={customValue} onChange={e => setCustomValue(e.target.value)} />
          </div>
          <div className="form-text">Not saved anywhere else.</div>
        </div>
      )}
    </div>
  );
};
