import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import { DataTable, type Column } from '../DataTable';

export interface CatalogRow { ID: string; SKU?: string; Name: string; Brand?: string; Model?: string; Variant?: string; Category_Name?: string; UOM: string; Status?: string }

interface Props {
  open: boolean;
  onClose: () => void;
  /** items already ticked (when coming back from the configuration step) */
  initial?: CatalogRow[];
  onNext: (items: CatalogRow[]) => void;
}

/** Step 1 of adding manual items: only choose which catalog items were received. Quantity and price are set in ManualItemConfigModal. */
export const ManualItemModal: React.FC<Props> = ({ open, onClose, initial, onNext }) => {
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Record<string, CatalogRow>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetchWithSwr<CatalogRow[]>('catalog:items', () => apiRequest<CatalogRow[]>('catalog:getItems'), (data) => {
      if (Array.isArray(data)) setCatalog(data.filter(r => String(r.Status || 'ACTIVE').toUpperCase() !== 'DISCONTINUED'));
      setLoading(false);
    }).catch(err => { setError(err.message || 'Failed to load the catalog.'); setLoading(false); });
    if (initial) setPicked(Object.fromEntries(initial.map(i => [i.ID, i])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => { setSearch(''); setPicked({}); onClose(); };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? catalog.filter(c => [c.ID, c.SKU, c.Name, c.Brand, c.Model, c.Variant, c.Category_Name].join(' ').toLowerCase().includes(q)) : catalog;
  }, [catalog, search]);

  const items = Object.values(picked);
  const toggle = (r: CatalogRow) => setPicked(prev => {
    const next = { ...prev };
    if (next[r.ID]) delete next[r.ID]; else next[r.ID] = r;
    return next;
  });
  const next = () => { const chosen = items; setSearch(''); setPicked({}); onNext(chosen); };

  const columns: Column<CatalogRow>[] = [
    { key: 'sel', label: '', width: '40px', render: r => (
      <input type="checkbox" className="form-check-input" aria-label={`Select ${r.Name}`} checked={!!picked[r.ID]} onChange={() => toggle(r)} />
    ) },
    { key: 'ID', label: 'Item', sortable: true, minWidth: '240px', render: r => (
      <div><span className="fw-semibold text-dark">{r.Name}</span><div className="small text-muted font-monospace">{r.ID}{r.SKU ? ` · ${r.SKU}` : ''}</div></div>
    ) },
    { key: 'Brand', label: 'Brand / Model', sortable: true, minWidth: '160px', render: r => [r.Brand, r.Model, r.Variant].filter(Boolean).join(' · ') || '—' },
    { key: 'Category_Name', label: 'Category', sortable: true, minWidth: '130px', render: r => r.Category_Name || '—' },
    { key: 'UOM', label: 'UOM', minWidth: '70px' },
  ];

  if (!open) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">Select items</h6>
              <div className="text-muted small">Tick every inventory item that was received. Quantity and price come next.</div>
            </div>
            <button type="button" className="btn-close" onClick={close}></button>
          </div>
          <div className="modal-body p-0">
            {error && <div className="alert alert-danger py-2 small m-3 mb-0">{error}</div>}
            {loading && (
              <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom small text-secondary" role="status">
                <span className="spinner-border spinner-border-sm text-primary"></span> {catalog.length ? 'Updating the catalog…' : 'Loading the catalog…'}
              </div>
            )}
            <DataTable columns={columns} data={rows} keyField="ID" searchQuery={search} onSearchChange={setSearch}
              searchPlaceholder="Search by name, ID, SKU, brand, model..." initialPageSize={10} emptyMessage="No items found." />
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top">
            <span className="me-auto small text-muted">{items.length} selected</span>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={next} disabled={items.length === 0}>Next: configure ({items.length})</button>
          </div>
        </div>
      </div>
    </div>
  );
};
