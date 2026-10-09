import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import type { CostPile, StorageOptions } from '../../types';

export interface PileChoice {
  areaId: string;
  customize: boolean;
  picks: Record<string, string>;
  reason: string;
}

export const EMPTY_PILE_CHOICE: PileChoice = { areaId: '', customize: false, picks: {}, reason: '' };

interface Props {
  itemId: string;
  location: string;
  quantity: number;
  value: PileChoice;
  onChange: (v: PileChoice) => void;
}

/** Area picker and the delivery piles (oldest first), with a ₱0 warning and the option to pick piles. */
export const DispatchPileSection: React.FC<Props> = ({ itemId, location, quantity, value, onChange }) => {
  const [storage, setStorage] = useState<StorageOptions>({ warehouses: [], storage: [] });
  const [piles, setPiles] = useState<CostPile[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<StorageOptions>('receiving:getStorageOptions').then(setStorage).catch(() => undefined);
  }, []);

  useEffect(() => {
    const id = itemId.trim();
    if (!id) { setPiles([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      apiRequest<{ layersEnabled: boolean; layers: CostPile[] }>('cost:listLayers', { itemId: id, location, areaId: value.areaId })
        .then(r => { if (!cancelled) { setEnabled(r.layersEnabled); setPiles(r.layers || []); setError(''); } })
        .catch(err => { if (!cancelled) setError(err.message || 'Could not load the deliveries.'); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [itemId, location, value.areaId]);

  const areas = storage.storage.filter(s => s.storageType === 'AREA' && s.warehouseLocation === location);
  const picked = Object.values(value.picks).reduce((s, v) => s + (Number(v) || 0), 0);

  // what the default (oldest first) would take, to show the ₱0 warning before dispatching
  let left = quantity;
  const defaultTake = piles.map(p => { const t = Math.max(0, Math.min(p.quantityRemaining, left)); left -= t; return t; });
  const zeroDefault = piles.some((p, i) => defaultTake[i] > 0 && p.unitCost <= 0);
  const zeroPicked = piles.some(p => (Number(value.picks[p.layerId]) || 0) > 0 && p.unitCost <= 0);

  return (
    <div>
      <div className="mb-3">
        <label className="form-label small fw-semibold">Area</label>
        <select className="form-select form-select-sm" value={value.areaId} onChange={e => onChange({ ...value, areaId: e.target.value, picks: {} })}>
          <option value="">Whole warehouse</option>
          {areas.map(a => <option key={a.storageId} value={a.storageId}>{a.name}{a.ownerSubDepartment ? ` — ${a.ownerSubDepartment}` : ''}</option>)}
        </select>
        <div className="form-text">The oldest delivery inside the chosen area is used first.</div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {enabled && itemId.trim() && (
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="small fw-semibold">Deliveries (oldest first)</span>
            <label className="form-check small mb-0">
              <input type="checkbox" className="form-check-input me-1" checked={value.customize}
                onChange={e => onChange({ ...value, customize: e.target.checked, picks: {} })} />
              Customize: pick deliveries
            </label>
          </div>
          {piles.length === 0 && <div className="small text-muted">No open deliveries of this item here.</div>}
          {piles.length > 0 && (
            <table className="table table-sm small mb-1">
              <thead className="table-light">
                <tr><th>Received</th><th className="text-end">Left</th><th className="text-end">Unit cost</th>{value.customize ? <th style={{ width: '100px' }}>Take</th> : <th className="text-end">Takes</th>}</tr>
              </thead>
              <tbody>
                {piles.map((p, i) => (
                  <tr key={p.layerId} className={p.unitCost <= 0 ? 'table-warning' : ''}>
                    <td>{p.receivedAt}<div className="text-muted font-monospace" style={{ fontSize: '0.7rem' }}>{p.layerId}{p.areaId ? ` · ${p.areaId}` : ''}</div></td>
                    <td className="text-end">{p.quantityRemaining}</td>
                    <td className="text-end">{p.unitCost > 0 ? `₱${p.unitCost.toFixed(2)}` : <span className="badge bg-warning text-dark">no price</span>}</td>
                    <td className="text-end">
                      {value.customize ? (
                        <input type="number" min="0" max={p.quantityRemaining} step="any" className="form-control form-control-sm"
                          value={value.picks[p.layerId] || ''} onChange={e => onChange({ ...value, picks: { ...value.picks, [p.layerId]: e.target.value } })} />
                      ) : (defaultTake[i] > 0 ? defaultTake[i] : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {value.customize && (
            <>
              <div className={`small mb-2 ${Math.abs(picked - quantity) < 1e-9 ? 'text-success' : 'text-danger'}`}>Picked {picked} of {quantity}.</div>
              <label className="form-label small fw-semibold mb-1">Reason for picking these deliveries</label>
              <input type="text" className="form-control form-control-sm"
                value={value.reason} onChange={e => onChange({ ...value, reason: e.target.value })} />
            </>
          )}
          {(value.customize ? zeroPicked : zeroDefault) && (
            <div className="alert alert-warning py-2 small mt-2 mb-0">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              Part of this dispatch comes from a delivery with no price. The project is charged ₱0 for it until a Head or Super Admin sets the price.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
