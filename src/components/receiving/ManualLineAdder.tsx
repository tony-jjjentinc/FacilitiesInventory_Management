import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import type { ReceivingLine, ResolvedPrice } from '../../types';
import { StepCard } from './StepCard';
import { newLineKey, priceFields } from './receivingUtils';

interface CatalogRow { ID: string; Name: string; UOM: string; Status?: string }

interface Props {
  onAdd: (line: ReceivingLine) => void;
}

/** Picks a catalog item for a manual receipt and pre-fills its resolved price. */
export const ManualLineAdder: React.FC<Props> = ({ onAdd }) => {
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<CatalogRow[]>('catalog:getItems', {})
      .then(rows => setCatalog((Array.isArray(rows) ? rows : []).filter(r => String(r.Status || 'ACTIVE').toUpperCase() !== 'DISCONTINUED')))
      .catch(err => setError(err.message || 'Failed to load the catalog.'));
  }, []);

  const picked = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return catalog.find(c => `${c.ID} — ${c.Name}`.toLowerCase() === q || c.ID.toLowerCase() === q) || null;
  }, [query, catalog]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) { setError('Pick an item from the list.'); return; }
    setBusy(true);
    setError('');
    try {
      const prices = await apiRequest<Record<string, ResolvedPrice>>('receiving:getItemPrices', { itemIds: [picked.ID] });
      const price = prices[picked.ID] || { unitCost: null, source: 'NONE', supplierId: '', supplierName: '' };
      onAdd({
        key: newLineKey(), itemId: picked.ID, itemName: picked.Name, mapped: true,
        receivedQty: qty || '1', uom: picked.UOM || 'pc',
        ...priceFields(price), serialNumber: '', storageId: '', lineStatus: 'VERIFIED', mismatchDetails: ''
      });
      setQuery('');
      setQty('1');
    } catch (err: any) {
      setError(err.message || 'Failed to add the item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepCard title="Add an item" hint="Search the catalog by item ID or name.">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <form onSubmit={add} className="row g-2 align-items-end">
        <div className="col-md-7">
          <label className="form-label small fw-semibold mb-1">Item</label>
          <input list="receiving-catalog" className="form-control form-control-sm" value={query} onChange={e => setQuery(e.target.value)} />
          <datalist id="receiving-catalog">
            {catalog.map(c => <option key={c.ID} value={`${c.ID} — ${c.Name}`} />)}
          </datalist>
        </div>
        <div className="col-md-3">
          <label className="form-label small fw-semibold mb-1">Quantity</label>
          <input type="number" min="0" step="any" className="form-control form-control-sm" value={qty} onChange={e => setQty(e.target.value)} />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-outline-primary btn-sm w-100" disabled={busy}>Add</button>
        </div>
      </form>
    </StepCard>
  );
};
