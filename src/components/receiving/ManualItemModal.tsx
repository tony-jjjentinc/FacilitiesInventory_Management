import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import { DataTable, type Column } from '../DataTable';
import type { ReceivingLine, ResolvedPrice } from '../../types';
import { PriceChooser } from './PriceChooser';
import { newLineKey, priceFields } from './receivingUtils';

interface CatalogRow { ID: string; SKU?: string; Name: string; Brand?: string; Model?: string; Variant?: string; Category_Name?: string; UOM: string; Status?: string }

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (line: ReceivingLine) => void;
}

/** Add one item to a manual receipt: pick the catalog item, then quantity, serial and price (supplier, base or custom). */
export const ManualItemModal: React.FC<Props> = ({ open, onClose, onAdd }) => {
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<CatalogRow | null>(null);
  const [base, setBase] = useState<ReceivingLine | null>(null);
  const [draft, setDraft] = useState<{ line: ReceivingLine; valid: boolean } | null>(null);
  const [qty, setQty] = useState('1');
  const [serial, setSerial] = useState('');
  const [pricing, setPricing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetchWithSwr<CatalogRow[]>('catalog:items', () => apiRequest<CatalogRow[]>('catalog:getItems'), (data) => {
      if (Array.isArray(data)) setCatalog(data.filter(r => String(r.Status || 'ACTIVE').toUpperCase() !== 'DISCONTINUED'));
      setLoading(false);
    }).catch(err => { setError(err.message || 'Failed to load the catalog.'); setLoading(false); });
  }, [open]);

  const reset = () => { setSearch(''); setPicked(null); setBase(null); setDraft(null); setQty('1'); setSerial(''); setError(''); };
  const close = () => { reset(); onClose(); };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? catalog.filter(c => [c.ID, c.SKU, c.Name, c.Brand, c.Model, c.Variant, c.Category_Name].join(' ').toLowerCase().includes(q)) : catalog;
  }, [catalog, search]);

  const pick = async (item: CatalogRow) => {
    setPicked(item);
    setPricing(true);
    setError('');
    try {
      const prices = await apiRequest<Record<string, ResolvedPrice>>('receiving:getItemPrices', { itemIds: [item.ID] });
      const price = prices[item.ID] || { unitCost: null, source: 'NONE', supplierId: '', supplierName: '' };
      setBase({
        key: newLineKey(), itemId: item.ID, itemName: item.Name, mapped: true,
        receivedQty: '1', uom: item.UOM || 'pc',
        ...priceFields(price), serialNumber: '', storageId: '', lineStatus: 'VERIFIED', mismatchDetails: ''
      });
    } catch (err: any) {
      setPicked(null);
      setError(err.message || 'Failed to load the prices of this item.');
    } finally {
      setPricing(false);
    }
  };

  const qtyNum = Number(qty);
  const qtyOk = isFinite(qtyNum) && qtyNum > 0;
  // an item without any price can still be added: it is received unpriced and priced later
  const canAdd = !!picked && !!base && qtyOk && (draft ? draft.valid : false);

  const add = () => {
    if (!draft || !canAdd) return;
    onAdd({ ...draft.line, receivedQty: qty, serialNumber: serial.trim() });
    close();
  };

  const columns: Column<CatalogRow>[] = [
    { key: 'ID', label: 'Item', sortable: true, minWidth: '240px', render: r => (
      <div><span className="fw-semibold text-dark">{r.Name}</span><div className="small text-muted font-monospace">{r.ID}{r.SKU ? ` · ${r.SKU}` : ''}</div></div>
    ) },
    { key: 'Brand', label: 'Brand / Model', sortable: true, minWidth: '160px', render: r => [r.Brand, r.Model, r.Variant].filter(Boolean).join(' · ') || '—' },
    { key: 'Category_Name', label: 'Category', sortable: true, minWidth: '130px', render: r => r.Category_Name || '—' },
    { key: 'UOM', label: 'UOM', minWidth: '70px' },
    { key: 'actions', label: '', align: 'right', minWidth: '90px', render: r => <button type="button" className="btn btn-primary btn-sm py-0" onClick={() => pick(r)}>Select</button> }
  ];

  if (!open) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">{picked ? 'Item details' : 'Select an item'}</h6>
              <div className="text-muted small">{picked ? 'Set the quantity and where the price comes from.' : 'Pick the inventory item that was received.'}</div>
            </div>
            <button type="button" className="btn-close" onClick={close}></button>
          </div>

          <div className="modal-body p-0">
            {error && <div className="alert alert-danger py-2 small m-3 mb-0">{error}</div>}

            {!picked && (
              <>
                {loading && (
                  <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom small text-secondary" role="status">
                    <span className="spinner-border spinner-border-sm text-primary"></span> {catalog.length ? 'Updating the catalog…' : 'Loading the catalog…'}
                  </div>
                )}
                <DataTable
                  columns={columns}
                  data={rows}
                  keyField="ID"
                  searchQuery={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search by name, ID, SKU, brand, model..."
                  initialPageSize={10}
                  emptyMessage="No items found."
                />
              </>
            )}

            {picked && (
              <div className="p-4">
                <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                  <div>
                    <div className="fw-semibold text-dark">{picked.Name}</div>
                    <div className="small text-muted font-monospace">{picked.ID}{picked.SKU ? ` · ${picked.SKU}` : ''} · {picked.UOM}</div>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPicked(null); setBase(null); setDraft(null); }}>Change item</button>
                </div>

                {pricing && (
                  <div className="d-flex align-items-center gap-2 small text-secondary" role="status">
                    <span className="spinner-border spinner-border-sm text-primary"></span> Loading prices…
                  </div>
                )}

                {base && (
                  <div className="row g-4">
                    <div className="col-md-5">
                      <label className="form-label small fw-semibold mb-1" htmlFor="manual-qty">Quantity ({picked.UOM || 'pc'})</label>
                      <input id="manual-qty" type="number" min="0" step="any" className={`form-control form-control-sm ${qtyOk ? '' : 'is-invalid'}`} value={qty} onChange={e => setQty(e.target.value)} />
                      <label className="form-label small fw-semibold mb-1 mt-3" htmlFor="manual-serial">Serial number</label>
                      <input id="manual-serial" className="form-control form-control-sm" value={serial} onChange={e => setSerial(e.target.value)} />
                      <div className="form-text">Leave blank if the item has no serial number.</div>
                    </div>
                    <div className="col-md-7">
                      <div className="small fw-semibold mb-2">Price</div>
                      <PriceChooser line={base} onChange={(l, valid) => setDraft({ line: l, valid })} />
                      {base.priceOptions.length === 0 && (
                        <div className="form-text mt-2">No price yet: enter a base price or a custom price.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer py-2 px-4 bg-light border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={close}>Cancel</button>
            {picked && <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!canAdd}>Add item</button>}
          </div>
        </div>
      </div>
    </div>
  );
};
