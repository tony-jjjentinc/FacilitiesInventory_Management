import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import type { ReceivingLine, ResolvedPrice } from '../../types';
import { PriceChooser } from './PriceChooser';
import { newLineKey, priceFields } from './receivingUtils';
import type { CatalogRow } from './ManualItemModal';

interface Props {
  /** the catalog items chosen in the selection step; null = closed */
  selected: CatalogRow[] | null;
  onBack: (remaining: CatalogRow[]) => void;
  onClose: () => void;
  onAdd: (lines: ReceivingLine[]) => void;
}

/** Second step of adding manual items: quantity, serial and price (supplier, base or custom) for each chosen item. */
export const ManualItemConfigModal: React.FC<Props> = ({ selected, onBack, onClose, onAdd }) => {
  const [items, setItems] = useState<CatalogRow[]>([]);
  const [bases, setBases] = useState<Record<string, ReceivingLine>>({});
  const [drafts, setDrafts] = useState<Record<string, { line: ReceivingLine; valid: boolean }>>({});
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [serials, setSerials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selected) return;
    setItems(selected);
    setBases({}); setDrafts({}); setSerials({}); setError('');
    setQtys(Object.fromEntries(selected.map(i => [i.ID, '1'])));
    setLoading(true);
    apiRequest<Record<string, ResolvedPrice>>('receiving:getItemPrices', { itemIds: selected.map(i => i.ID) })
      .then(prices => {
        const next: Record<string, ReceivingLine> = {};
        for (const item of selected) {
          const price = prices[item.ID] || { unitCost: null, source: 'NONE', supplierId: '', supplierName: '' };
          next[item.ID] = {
            key: newLineKey(), itemId: item.ID, itemName: item.Name, mapped: true,
            receivedQty: '1', uom: item.UOM || 'pc',
            ...priceFields(price), serialNumber: '', storageId: '', lineStatus: 'VERIFIED', mismatchDetails: ''
          };
        }
        setBases(next);
      })
      .catch(err => setError(err.message || 'Failed to load the prices of the selected items.'))
      .finally(() => setLoading(false));
  }, [selected]);

  if (!selected) return null;

  const qtyOk = (id: string) => { const n = Number(qtys[id]); return isFinite(n) && n > 0; };
  // an item without any price can still be added: it is received unpriced and priced later
  const canAdd = !loading && items.length > 0 && items.every(i => bases[i.ID] && qtyOk(i.ID) && drafts[i.ID]?.valid);
  const add = () => {
    if (!canAdd) return;
    onAdd(items.map(i => ({ ...drafts[i.ID].line, receivedQty: qtys[i.ID], serialNumber: (serials[i.ID] || '').trim() })));
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">Configure items</h6>
              <div className="text-muted small">Set the quantity and the price (supplier, base or one-time custom) of each selected item.</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-3">
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            {loading && (
              <div className="d-flex align-items-center gap-2 small text-secondary" role="status">
                <span className="spinner-border spinner-border-sm text-primary"></span> Loading prices…
              </div>
            )}
            <div className="d-flex flex-column gap-3">
              {items.map(item => {
                    const base = bases[item.ID];
                    if (!base) return null;
                    return (
                      <div key={item.ID} className="border rounded p-3">
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                          <div>
                            <div className="fw-semibold text-dark">{item.Name}</div>
                            <div className="small text-muted font-monospace">{item.ID}{item.SKU ? ` · ${item.SKU}` : ''} · {item.UOM}</div>
                          </div>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={items.length === 1}
                            onClick={() => setItems(prev => prev.filter(i => i.ID !== item.ID))}>Remove</button>
                        </div>
                        <div className="row g-4">
                          <div className="col-md-5">
                            <label className="form-label small fw-semibold mb-1" htmlFor={`qty-${item.ID}`}>Quantity ({item.UOM || 'pc'})</label>
                            <input id={`qty-${item.ID}`} type="number" min="0" step="any" className={`form-control form-control-sm ${qtyOk(item.ID) ? '' : 'is-invalid'}`}
                              value={qtys[item.ID] ?? '1'} onChange={e => setQtys(p => ({ ...p, [item.ID]: e.target.value }))} />
                            <label className="form-label small fw-semibold mb-1 mt-3" htmlFor={`serial-${item.ID}`}>Serial number</label>
                            <input id={`serial-${item.ID}`} className="form-control form-control-sm" value={serials[item.ID] || ''}
                              onChange={e => setSerials(p => ({ ...p, [item.ID]: e.target.value }))} />
                            <div className="form-text">Leave blank if the item has no serial number.</div>
                          </div>
                          <div className="col-md-7">
                            <div className="small fw-semibold mb-2">Price</div>
                            <PriceChooser line={base} onChange={(l, valid) => setDrafts(p => ({ ...p, [item.ID]: { line: l, valid } }))} />
                            {base.priceOptions.length === 0 && <div className="form-text mt-2">No price yet: enter a base price or a custom price.</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onBack(items)}>Back to selection</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!canAdd}>Add {items.length} item{items.length === 1 ? '' : 's'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
