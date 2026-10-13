/**
 * @file SpotStockModal.tsx
 * @description The items on one shelf / level / container / space (and everything below it), or the units of an area that are not
 * on any spot yet ("whole area"). Custodians can move units to another spot of the same area, or back to the whole area.
 * Quantities and costs of the area do not change by moving; every move is logged.
 */
import React, { useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { invalidateCache } from '../../services/cache';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { useToast } from '../../context/ToastContext';
import { Loading } from '../Loading';
import { Select } from '../Select';
import type { EntityStorageNode, SpotStock, SpotStockLine } from '../../types';
import { peso, qty as fmtQty } from './entityPaths';
import { useEntityData } from './useEntity';

interface Props {
  areaId: string;
  areaName: string;
  warehouseId: string;
  /** '' = the units of the area that are not on any spot */
  spotId: string;
  title: string;
  nodes: EntityStorageNode[];
  canMove: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const label = (n: EntityStorageNode) => n.name || (n.shelfNumber ? `Shelf ${n.shelfNumber}` : n.storageId);

export const SpotStockModal: React.FC<Props> = ({ areaId, areaName, warehouseId, spotId, title, nodes, canMove, onClose, onChanged }) => {
  const toast = useToast();
  const costs = getAccess(getCurrentUser()).canSeeCosts;
  const { data, loading, error, reload } = useEntityData<SpotStock>('getSpotStock', 'AREA', areaId, { spotId, deep: true });
  const [moving, setMoving] = useState<SpotStockLine | null>(null);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const path = (n: EntityStorageNode): string => {
    const parts = [label(n)];
    let up = nodes.find(x => x.storageId === n.parentStorageId);
    for (let i = 0; up && i < 6; i++) { parts.unshift(label(up)); up = nodes.find(x => x.storageId === up!.parentStorageId); }
    return parts.join(' › ');
  };
  const targets = useMemo(() => nodes.filter(n => n.status !== 'INACTIVE' && n.storageType !== 'AREA').map(n => ({ id: n.storageId, name: path(n) })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes]);

  const startMove = (l: SpotStockLine) => { setMoving(l); setTo(''); setAmount(String(l.qty)); };
  const n = Number(amount);
  const valid = !!moving && n > 0 && n <= moving.qty + 1e-9 && to !== moving.spotId;

  const submit = async () => {
    if (!moving || !valid) return;
    setBusy(true);
    try {
      await apiRequest('inventory:relocate', { warehouseLocation: warehouseId, areaId, items: [{ itemId: moving.itemId, serialNumber: moving.serialNumber, quantity: n, fromSpotId: moving.spotId, toSpotId: to }] });
      toast.success(`Moved ${fmtQty(n)} ${moving.uom}.`);
      invalidateCache('entity:');
      setMoving(null);
      reload();
      onChanged();
    } catch (e: any) { toast.error(e.message || 'Could not move the stock.'); } finally { setBusy(false); }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">{title}</h6>
              <div className="small text-muted">{areaName}{data ? ` · ${data.totals.lines} line(s) · ${fmtQty(data.totals.quantity)} units` : ''}</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={busy}></button>
          </div>
          <div className="modal-body p-0">
            {loading && !data ? <Loading label="Loading the items…" />
              : error && !data ? <div className="alert alert-danger small m-3">{error}</div>
                : data && !data.tracked ? <div className="text-muted small p-4">This workbook does not keep stock per shelf yet. Add the Storage_Stock tab (see docs/SHEETS.md).</div>
                  : data && data.lines.length === 0 ? <div className="text-muted small p-4">{spotId ? 'Nothing is on this spot.' : 'Every unit of this area is on a shelf or level.'}</div>
                    : (
                      <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                        <thead className="table-light"><tr><th className="ps-3">Item</th>{spotId && <th>Spot</th>}<th className="text-end">Quantity</th>{costs && <th className="text-end">Value</th>}{canMove && <th></th>}</tr></thead>
                        <tbody>
                          {data!.lines.map(l => (
                            <tr key={`${l.spotId}|${l.itemId}|${l.serialNumber}`}>
                              <td className="ps-3"><span className="fw-semibold">{l.name || l.itemId}</span><div className="small text-muted font-monospace">{l.itemId}{l.serialNumber && l.serialNumber !== 'N/A' ? ` · S/N ${l.serialNumber}` : ''}</div></td>
                              {spotId && <td>{l.spotName}</td>}
                              <td className="text-end">{fmtQty(l.qty)} <span className="text-muted">{l.uom}</span></td>
                              {costs && <td className="text-end">{peso(l.value)}</td>}
                              {canMove && <td className="text-end pe-3"><button type="button" className="btn btn-secondary btn-sm py-0" onClick={() => startMove(l)}>Move</button></td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
          </div>
          {moving && (
            <div className="modal-footer d-block bg-light border-top px-4 py-3">
              <div className="small fw-semibold mb-2">Move {moving.name || moving.itemId} from {moving.spotName}</div>
              <div className="row g-2 align-items-end">
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1" htmlFor="move-to">To</label>
                  <Select id="move-to" className="form-select form-select-sm" value={to} onChange={e => setTo(e.target.value)}>
                    {moving.spotId !== '' && <option value="">Whole area (not on a spot)</option>}
                    {targets.filter(t => t.id !== moving.spotId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted mb-1" htmlFor="move-qty">Quantity (max {fmtQty(moving.qty)})</label>
                  <input id="move-qty" className="form-control form-control-sm" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="col-md-3 d-flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" disabled={!valid || busy || (moving.spotId === '' && to === '')} onClick={submit}>{busy ? 'Moving...' : 'Move'}</button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setMoving(null)}>Cancel</button>
                </div>
              </div>
              <div className="small text-muted mt-2">Moving changes where the units sit, not how many there are or what they cost.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
