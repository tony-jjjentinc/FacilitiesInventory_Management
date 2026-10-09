import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { invalidateCache } from '../../services/cache';

interface Lookups {
  categories: { id: string; name: string }[];
  types: { id: string; name: string }[];
  uoms: { id: string; name: string }[];
  systems: string[];
  components: string[];
}

export interface AddedCatalogItem { itemId: string; sku: string; name: string; uom: string }

interface Props {
  open: boolean;
  /** The description ProcInv used; prefills the name and is mapped to the new item. */
  procurementName: string;
  defaultUom?: string;
  onClose: () => void;
  onAdded: (item: AddedCatalogItem) => void;
}

/** Adds an item to the inventory item catalog (Super Admin, Head, Sub-Department) and maps the ProcInv description to it. */
export const AddCatalogItemModal: React.FC<Props> = ({ open, procurementName, defaultUom, onClose, onAdded }) => {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [form, setForm] = useState({ name: '', categoryId: '', typeCode: '', brand: '', model: '', variant: '', system: '', component: '', uom: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(f => ({ ...f, name: procurementName, uom: defaultUom || '' }));
    apiRequest<Lookups>('catalog:getLookups')
      .then(l => {
        setLookups(l);
        setForm(f => ({
          ...f,
          categoryId: f.categoryId || l.categories[0]?.id || '',
          typeCode: f.typeCode || l.types[0]?.id || '',
          uom: l.uoms.some(u => u.id === (defaultUom || '')) ? (defaultUom as string) : (f.uom && l.uoms.some(u => u.id === f.uom) ? f.uom : l.uoms[0]?.id || '')
        }));
      })
      .catch(err => setError(err.message || 'Failed to load the catalog lists.'));
  }, [open, procurementName, defaultUom]);

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));
  const ready = !!lookups && form.name.trim() !== '' && form.categoryId !== '' && form.typeCode !== '' && form.uom !== '';

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    setError('');
    try {
      const added = await apiRequest<AddedCatalogItem>('catalog:addItem', { ...form, procurementName });
      invalidateCache('catalog:items');
      invalidateCache('config:Item');
      onAdded(added);
    } catch (err: any) {
      setError(err.message || 'Adding the item failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1065 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">Add to inventory catalog</h6>
              <div className="small text-muted">ProcInv description: {procurementName}</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>
          <div className="modal-body p-4">
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            {!lookups && !error && (
              <div className="d-flex align-items-center gap-2 small text-secondary" role="status">
                <span className="spinner-border spinner-border-sm text-primary"></span> Loading…
              </div>
            )}
            {lookups && (
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-name">Item name</label>
                  <input id="cat-name" className="form-control form-control-sm" value={form.name} onChange={e => set({ name: e.target.value })} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-category">Trade category</label>
                  <select id="cat-category" className="form-select form-select-sm" value={form.categoryId} onChange={e => set({ categoryId: e.target.value })}>
                    {lookups.categories.map(c => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-type">Inventory type</label>
                  <select id="cat-type" className="form-select form-select-sm" value={form.typeCode} onChange={e => set({ typeCode: e.target.value })}>
                    {lookups.types.map(t => <option key={t.id} value={t.id}>{t.id}{t.name ? ` - ${t.name}` : ''}</option>)}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-brand">Brand</label>
                  <input id="cat-brand" className="form-control form-control-sm" value={form.brand} onChange={e => set({ brand: e.target.value })} />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-model">Model</label>
                  <input id="cat-model" className="form-control form-control-sm" value={form.model} onChange={e => set({ model: e.target.value })} />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-variant">Variant</label>
                  <input id="cat-variant" className="form-control form-control-sm" value={form.variant} onChange={e => set({ variant: e.target.value })} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-system">System</label>
                  <input id="cat-system" list="cat-systems" className="form-control form-control-sm" value={form.system} onChange={e => set({ system: e.target.value })} />
                  <datalist id="cat-systems">{lookups.systems.map(s => <option key={s} value={s} />)}</datalist>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-component">Component</label>
                  <input id="cat-component" list="cat-components" className="form-control form-control-sm" value={form.component} onChange={e => set({ component: e.target.value })} />
                  <datalist id="cat-components">{lookups.components.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold mb-1" htmlFor="cat-uom">Unit of measure</label>
                  <select id="cat-uom" className="form-select form-select-sm" value={form.uom} onChange={e => set({ uom: e.target.value })}>
                    {lookups.uoms.map(u => <option key={u.id} value={u.id}>{u.id}{u.name ? ` - ${u.name}` : ''}</option>)}
                  </select>
                </div>
                <div className="col-12 form-text">
                  The item gets the next ITM number and SKU. The ProcInv description above is linked to it, so this and later MRLs with the same description resolve to it.
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!ready || saving}>{saving ? 'Adding…' : 'Add to catalog'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
