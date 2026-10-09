import React from 'react';
import type { ReceivingLine, ReceivingParty } from '../../types';

interface Props {
  open: boolean;
  title: string;
  reference: string;
  lines: ReceivingLine[];
  party: ReceivingParty;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Last look before a receipt is staged for the receiving party. */
export const ReceivingReviewModal: React.FC<Props> = ({ open, title, reference, lines, party, busy, onConfirm, onCancel }) => {
  if (!open) return null;
  const verified = lines.filter(l => l.lineStatus === 'VERIFIED');
  const rejected = lines.filter(l => l.lineStatus === 'REJECTED');
  const total = verified.reduce((s, l) => s + (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0), 0);
  const unpriced = verified.filter(l => (Number(l.unitCost) || 0) === 0).length;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <h6 className="modal-title fw-bold mb-0">{title}</h6>
            <button type="button" className="btn-close" onClick={onCancel} disabled={busy}></button>
          </div>
          <div className="modal-body p-4 small">
            <div className="row g-2 mb-3">
              <div className="col-6"><strong>Reference:</strong> <span className="font-monospace">{reference}</span></div>
              <div className="col-6"><strong>Receiving party:</strong> {party.receiverId}</div>
              <div className="col-12">
                <strong>Destination:</strong>{' '}
                {party.destinationType === 'ACTIVITY'
                  ? <>Direct to activity <span className="font-monospace">{party.activityId}</span></>
                  : <>Warehouse <span className="font-monospace">{party.warehouseLocation}</span>{party.areaId ? <> · area <span className="font-monospace">{party.areaId}</span></> : null}</>}
              </div>
            </div>
            <table className="table table-sm mb-3">
              <thead className="table-light"><tr><th>Item</th><th className="text-end">Qty</th><th className="text-end">Unit cost</th><th>Result</th></tr></thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.key} className={l.lineStatus === 'REJECTED' ? 'table-danger-subtle' : ''}>
                    <td><span className="font-monospace">{l.itemId}</span> {l.itemName}</td>
                    <td className="text-end">{l.lineStatus === 'VERIFIED' ? l.receivedQty : l.releasedQty ?? '—'}</td>
                    <td className="text-end">{l.lineStatus === 'VERIFIED' ? (Number(l.unitCost) > 0 ? `₱${Number(l.unitCost).toFixed(2)}` : 'to be priced') : '—'}</td>
                    <td>{l.lineStatus === 'VERIFIED' ? 'Receive' : `Return to ProcInv (MRT): ${l.mismatchDetails}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mb-2">
              <strong>{verified.length}</strong> to receive (₱{total.toFixed(2)}), <strong>{rejected.length}</strong> returned via MRT
              {unpriced > 0 ? <>, <span className="text-warning-emphasis">{unpriced} without a price yet</span></> : null}.
            </div>
            <div className="alert alert-info py-2 mb-0">
              Nothing changes in the inventory yet. <strong>{party.receiverId}</strong> must confirm receipt with their own login first.
            </div>
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={busy}>Back</button>
            <button type="button" className="btn btn-success btn-sm" onClick={onConfirm} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit for confirmation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
