import React, { useState } from 'react';
import type { ReceivingLine, StorageNode } from '../../types';
import { PriceChooser } from './PriceChooser';
import { nodeLabel, spotPath } from './receivingUtils';

interface Props {
  line: ReceivingLine;
  mode: 'MRL' | 'MANUAL';
  uoms: string[];
  spotOptions: StorageNode[];
  allStorage: StorageNode[];
  onClose: () => void;
  onApply: (line: ReceivingLine) => void;
}

/** Everything that can be changed on one received item: quantity, unit, price, serial number and storage spot. */
export const LineEditModal: React.FC<Props> = ({ line, mode, uoms, spotOptions, allStorage, onClose, onApply }) => {
  const [qty, setQty] = useState(line.receivedQty);
  const [uom, setUom] = useState(line.uom);
  const [serial, setSerial] = useState(line.serialNumber === 'N/A' ? '' : line.serialNumber);
  const [storageId, setStorageId] = useState(line.storageId);
  const [price, setPrice] = useState<{ line: ReceivingLine; valid: boolean }>({ line, valid: true });

  const qtyNum = Number(qty);
  const over = mode === 'MRL' && line.releasedQty !== undefined && qtyNum > line.releasedQty;
  const qtyOk = isFinite(qtyNum) && qtyNum > 0 && !over;
  const unitApplies = uoms.length > 0 && !!line.catalogUom && line.uom !== line.catalogUom;
  const unitOptions = Array.from(new Set([line.uom, ...(unitApplies ? uoms : [])]));

  const apply = () => {
    if (!qtyOk) return;
    // an incomplete price choice leaves the price as it was (an unpriced item can be priced later)
    const priced = price.valid ? price.line : line;
    onApply({ ...priced, receivedQty: qty, uom, serialNumber: serial.trim(), storageId });
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1065 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">Update item</h6>
              <div className="small text-muted"><span className="font-monospace">{line.itemId}</span> — {line.itemName}</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            <div className="row g-4">
              <div className="col-md-5">
                <label className="form-label small fw-semibold mb-1" htmlFor="edit-qty">
                  Received quantity{mode === 'MRL' && line.releasedQty !== undefined ? ` (released ${line.releasedQty})` : ''}
                </label>
                <input id="edit-qty" type="number" min="0" step="any" className={`form-control form-control-sm ${qtyOk ? '' : 'is-invalid'}`} value={qty} onChange={e => setQty(e.target.value)} />
                {over && <div className="invalid-feedback d-block">Cannot exceed the released quantity.</div>}

                <label className="form-label small fw-semibold mb-1 mt-3" htmlFor="edit-uom">Unit</label>
                {unitApplies ? (
                  <>
                    <select id="edit-uom" className="form-select form-select-sm" value={uom} onChange={e => setUom(e.target.value)}>
                      {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <div className="form-text">ProcInv says {line.uom}, the catalog says {line.catalogUom}. No conversion is applied: enter the quantity in the unit you choose.</div>
                  </>
                ) : (
                  <input id="edit-uom" className="form-control form-control-sm" value={line.uom} disabled />
                )}

                <label className="form-label small fw-semibold mb-1 mt-3" htmlFor="edit-serial">Serial number</label>
                <input id="edit-serial" className="form-control form-control-sm" value={serial} onChange={e => setSerial(e.target.value)} />
                <div className="form-text">Leave blank if the item has no serial number.</div>

                {spotOptions.length > 0 && (
                  <>
                    <label className="form-label small fw-semibold mb-1 mt-3" htmlFor="edit-spot">Storage spot</label>
                    <select id="edit-spot" className="form-select form-select-sm" value={storageId} onChange={e => setStorageId(e.target.value)}>
                      <option value="">Whole area</option>
                      {spotOptions.map(sp => <option key={sp.storageId} value={sp.storageId}>{spotPath(allStorage, sp.storageId) || nodeLabel(sp)}</option>)}
                    </select>
                  </>
                )}
              </div>

              <div className="col-md-7">
                <div className="small fw-semibold mb-2">Price</div>
                <PriceChooser line={line} onChange={(l, valid) => setPrice({ line: l, valid })} />
                {!price.valid && <div className="form-text mt-2">The price stays as it is until a complete price is entered.</div>}
              </div>
            </div>
          </div>

          <div className="modal-footer py-2 px-4 bg-light border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={!qtyOk}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
};
