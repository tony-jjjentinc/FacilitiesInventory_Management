import React, { useState } from 'react';
import { peso } from '../utils/format';

type Mode = 'unit' | 'gross';
const trim4 = (n: number) => String(Number(n.toFixed(4)));

interface ModalProps {
  itemName?: string;
  uom?: string;
  /** the quantity the price is for; shown and editable, so a gross price can be split across it */
  quantity?: number;
  /** what the field holds now */
  value?: string;
  onApply: (unitCost: string) => void;
  onClose: () => void;
}

/** Works out a unit price from either "unit price" or "gross price for the quantity", with the other shown live. Applies the unit price. */
export const PriceModal: React.FC<ModalProps> = ({ itemName, uom, quantity, value, onApply, onClose }) => {
  const [mode, setMode] = useState<Mode>('gross');
  const [qty, setQty] = useState(quantity && quantity > 0 ? String(quantity) : '');
  const [amount, setAmount] = useState(mode === 'unit' ? value || '' : '');
  const q = Number(qty), a = Number(amount);
  const unit = mode === 'unit' ? a : (q > 0 ? a / q : 0);
  const total = mode === 'unit' ? a * q : a;
  const valid = isFinite(unit) && unit > 0 && (mode === 'unit' || q > 0);
  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header"><h6 className="modal-title fw-bold">Set the price{itemName ? `: ${itemName}` : ''}</h6><button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button></div>
          <div className="modal-body">
            <div className="btn-group btn-group-sm w-100 mb-3" role="group" aria-label="How to enter the price">
              <button type="button" className={`btn ${mode === 'gross' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setMode('gross'); setAmount(''); }}>Gross price (total)</button>
              <button type="button" className={`btn ${mode === 'unit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setMode('unit'); setAmount(''); }}>Unit price</button>
            </div>
            <div className="row g-3">
              <div className="col-6">
                <label className="form-label small fw-semibold" htmlFor="pm-qty">Quantity{uom ? ` (${uom})` : ''}</label>
                <input id="pm-qty" type="number" min="0" step="any" className="form-control form-control-sm" value={qty} onChange={e => setQty(e.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold" htmlFor="pm-amount">{mode === 'gross' ? 'Gross price for the quantity' : 'Price per unit'}</label>
                <div className="input-group input-group-sm"><span className="input-group-text">₱</span>
                  <input id="pm-amount" type="number" min="0" step="any" autoFocus className="form-control" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              </div>
            </div>
            <div className="border rounded bg-light p-2 mt-3 small d-flex justify-content-between" role="status">
              <span>{mode === 'gross' ? 'Unit price' : 'Total'}: <strong>{valid ? (mode === 'gross' ? `₱${trim4(unit)}` : peso(total)) : '–'}</strong></span>
              {valid && q > 0 && <span className="text-muted">{trim4(q)} × ₱{trim4(unit)} = {peso(q * Number(trim4(unit)))}</span>}
            </div>
            {mode === 'gross' && <div className="form-text">The system keeps one price per unit (up to 4 decimals), so a total that does not divide evenly can differ by a centavo.</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!valid} onClick={() => onApply(trim4(unit))}>Use this price</button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ButtonProps extends Omit<ModalProps, 'onClose'> { className?: string }

/** A small "calculator" button for a price field; opens the PriceModal and hands the unit price back. */
export const PriceCalcButton: React.FC<ButtonProps> = ({ className = '', ...props }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn btn-secondary btn-sm ${className}`} title="Enter a gross price or a unit price" aria-label="Price calculator" onClick={() => setOpen(true)}><i className="bi bi-calculator"></i></button>
      {open && <PriceModal {...props} onApply={v => { props.onApply(v); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
};
