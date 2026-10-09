import React from 'react';
import type { ReceivingLine } from '../../types';

interface Props {
  lines: ReceivingLine[];
  onClear: () => void;
  onReview: () => void;
  disabled?: boolean;
}

/** Sticky summary at the bottom of the form: what will happen, and the one button that moves on. */
export const SubmitBar: React.FC<Props> = ({ lines, onClear, onReview, disabled }) => {
  const verified = lines.filter(l => l.lineStatus === 'VERIFIED');
  const invalid = lines.length - verified.length;
  const total = verified.reduce((s, l) => s + (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0), 0);
  const unpriced = verified.filter(l => (Number(l.unitCost) || 0) === 0).length;

  return (
    <div className="position-sticky bottom-0 bg-white border-top py-3 mt-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2" style={{ zIndex: 5 }}>
      <div className="small text-secondary">
        <span className="text-dark fw-semibold">{verified.length}</span> to receive
        {invalid > 0 && <>, <span className="text-dark fw-semibold">{invalid}</span> invalid</>}
        {' · '}
        <span className="text-dark fw-semibold">₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        {unpriced > 0 && <span className="text-warning-emphasis"> · {unpriced} without a price</span>}
      </div>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClear}>Clear</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onReview} disabled={disabled}>Review and submit</button>
      </div>
    </div>
  );
};
