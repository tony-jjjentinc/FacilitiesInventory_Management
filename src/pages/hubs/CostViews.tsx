import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import type { OpenActivity, ProjectCostsResponse, StockCostsResponse, StorageOptions } from '../../types';

const peso = (n: number) => `₱${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cost4 = (n: number) => `₱${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export interface PriceDraft { scopeType: string; scopeRef: string; itemId: string; }

export const CostOfStock: React.FC<{ isAdmin: boolean; onSetPrice: (d: PriceDraft) => void }> = ({ isAdmin, onSetPrice }) => {
  const [data, setData] = useState<StockCostsResponse | null>(null);
  const [needsPrice, setNeedsPrice] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setData(await apiRequest<StockCostsResponse>('cost:getStockCosts', { needsPrice })); }
    catch (err: any) { setError(err.message || 'Failed to load the cost of stock.'); }
  }, [needsPrice]);
  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items || []).filter(i => !q || `${i.itemId} ${i.itemName} ${i.location}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {data && !data.layersEnabled && (
        <div className="alert alert-info py-2 small">Delivery costing is off, so each row shows the item's average cost as one pile.</div>
      )}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><div className="small text-secondary">Stock value</div><div className="h5 fw-bold mb-0">{peso(data?.totals.value || 0)}</div></div></div></div>
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><div className="small text-secondary">Items</div><div className="h5 fw-bold mb-0">{data?.items.length ?? 0}</div></div></div></div>
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><div className="small text-secondary">Need a price</div><div className="h5 fw-bold mb-0 text-warning-emphasis">{data?.totals.needsPriceItems ?? 0}</div></div></div></div>
      </div>
      <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
        <input className="form-control form-control-sm" style={{ maxWidth: '280px' }} placeholder="Search item or location…" value={search} onChange={e => setSearch(e.target.value)} />
        <label className="form-check small mb-0"><input type="checkbox" className="form-check-input me-1" checked={needsPrice} onChange={e => setNeedsPrice(e.target.checked)} />Needs price only</label>
      </div>
      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="table-light"><tr><th></th><th>Item</th><th>Location</th><th className="text-end">Quantity</th><th className="text-end">Value</th><th>Price</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Nothing to show.</td></tr>}
              {items.map(i => {
                const key = `${i.itemId}|${i.location}`;
                const isOpen = open === key;
                return (
                  <React.Fragment key={key}>
                    <tr>
                      <td style={{ width: '32px' }}><button type="button" className="btn btn-link btn-sm p-0" aria-label="Show deliveries" onClick={() => setOpen(isOpen ? '' : key)}><i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i></button></td>
                      <td><span className="font-monospace fw-bold">{i.itemId}</span> <span className="text-muted">— {i.itemName}</span></td>
                      <td className="font-monospace small">{i.location}</td>
                      <td className="text-end">{i.quantity} {i.uom}</td>
                      <td className="text-end fw-semibold">{peso(i.value)}</td>
                      <td>{i.needsPrice ? <span className="badge bg-warning-subtle text-warning-emphasis border">Needs price</span> : <span className="badge bg-success-subtle text-success border">Priced</span>}</td>
                    </tr>
                    {isOpen && (
                      <tr className="table-light">
                        <td></td>
                        <td colSpan={5}>
                          <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
                            <thead><tr><th>Delivery</th><th>Received</th><th>Area</th><th className="text-end">Left / received</th><th className="text-end">Unit cost</th><th className="text-end">Value</th><th>Source</th><th></th></tr></thead>
                            <tbody>
                              {i.piles.map(p => (
                                <tr key={p.layerId || p.sourceTransactionId + p.areaId}>
                                  <td className="font-monospace">{p.layerId || '—'}</td>
                                  <td>{p.receivedAt}</td>
                                  <td className="font-monospace">{p.areaId || '—'}</td>
                                  <td className="text-end">{p.quantityRemaining} / {p.quantityReceived}</td>
                                  <td className="text-end">{p.unitCost > 0 ? cost4(p.unitCost) : <span className="badge bg-warning text-dark">no price</span>}</td>
                                  <td className="text-end">{peso(p.value)}</td>
                                  <td>{p.source}{p.receiptId ? ` · ${p.receiptId}` : ''}</td>
                                  <td className="text-end">
                                    {isAdmin && data?.layersEnabled && p.unitCost <= 0 && (
                                      <button type="button" className="btn btn-outline-primary btn-sm py-0" onClick={() => onSetPrice(p.areaId ? { scopeType: 'AREA', scopeRef: p.areaId, itemId: i.itemId } : { scopeType: 'WAREHOUSE', scopeRef: i.location, itemId: i.itemId })}>Set price</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const CostPerProject: React.FC<{ isAdmin: boolean; onSetPrice: (d: PriceDraft) => void }> = ({ isAdmin, onSetPrice }) => {
  const [data, setData] = useState<ProjectCostsResponse | null>(null);
  const [needsPrice, setNeedsPrice] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setData(await apiRequest<ProjectCostsResponse>('cost:getProjectCosts', { needsPrice })); }
    catch (err: any) { setError(err.message || 'Failed to load project costs.'); }
  }, [needsPrice]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.activities || []).filter(a => !q || `${a.activityId} ${a.activityName} ${a.procInvClassRef}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><div className="small text-secondary">Total charged</div><div className="h5 fw-bold mb-0">{peso(data?.totals.cost || 0)}</div></div></div></div>
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><div className="small text-secondary">Need a price</div><div className="h5 fw-bold mb-0 text-warning-emphasis">{data?.totals.needsPriceActivities ?? 0}</div></div></div></div>
      </div>
      <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
        <input className="form-control form-control-sm" style={{ maxWidth: '280px' }} placeholder="Search activity…" value={search} onChange={e => setSearch(e.target.value)} />
        <label className="form-check small mb-0"><input type="checkbox" className="form-check-input me-1" checked={needsPrice} onChange={e => setNeedsPrice(e.target.checked)} />Needs price only</label>
      </div>
      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="table-light"><tr><th></th><th>Activity</th><th>Status</th><th className="text-end">Charged</th><th>Price</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">Nothing to show.</td></tr>}
              {list.map(a => {
                const isOpen = open === a.activityId;
                return (
                  <React.Fragment key={a.activityId}>
                    <tr>
                      <td style={{ width: '32px' }}><button type="button" className="btn btn-link btn-sm p-0" aria-label="Show lines" onClick={() => setOpen(isOpen ? '' : a.activityId)}><i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i></button></td>
                      <td><span className="font-monospace fw-bold">{a.activityId}</span> <span className="text-muted">— {a.activityName}</span>{a.procInvClassRef ? <span className="badge bg-light text-dark border ms-2">{a.procInvClassRef}</span> : null}</td>
                      <td>{a.status}</td>
                      <td className="text-end fw-semibold">{peso(a.currentNetCost)}</td>
                      <td>{a.needsPrice ? <span className="badge bg-warning-subtle text-warning-emphasis border">Needs price</span> : <span className="badge bg-success-subtle text-success border">Priced</span>}</td>
                    </tr>
                    {isOpen && (
                      <tr className="table-light">
                        <td></td>
                        <td colSpan={4}>
                          <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
                            <thead><tr><th>Item</th><th className="text-end">Net issued</th><th className="text-end">Charged per unit</th><th className="text-end">Cost</th><th>Deliveries used</th><th></th></tr></thead>
                            <tbody>
                              {a.lines.map(l => (
                                <tr key={l.itemId + l.serialNumber} className={l.needsPrice ? 'table-warning' : ''}>
                                  <td><span className="font-monospace">{l.itemId}</span> {l.itemName}</td>
                                  <td className="text-end">{l.netUsed}</td>
                                  <td className="text-end">{l.unitCostBilled > 0 ? cost4(l.unitCostBilled) : <span className="badge bg-warning text-dark">no price</span>}</td>
                                  <td className="text-end">{peso(l.cost)}</td>
                                  <td>{l.piles.length === 0 ? '—' : l.piles.map((p, k) => <span key={k} className="badge bg-light text-dark border me-1" title={p.transactionId}>{p.quantity} × {cost4(p.unitCost)}{p.layerId ? ` (${p.layerId})` : ''}</span>)}</td>
                                  <td className="text-end">{isAdmin && l.needsPrice && <button type="button" className="btn btn-outline-primary btn-sm py-0" onClick={() => onSetPrice({ scopeType: 'ACTIVITY', scopeRef: a.activityId, itemId: l.itemId })}>Set price</button>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const SetPrice: React.FC = () => {
  const [params] = useSearchParams();
  const [draft, onDraft] = useState<PriceDraft>({ scopeType: params.get('scopeType') || 'AREA', scopeRef: params.get('scopeRef') || '', itemId: params.get('itemId') || '' });
  const [storage, setStorage] = useState<StorageOptions>({ warehouses: [], storage: [] });
  const [activities, setActivities] = useState<OpenActivity[]>([]);
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    apiRequest<StorageOptions>('receiving:getStorageOptions').then(setStorage).catch(() => undefined);
    apiRequest<OpenActivity[]>('activity:getAll', { status: 'ALL' }).then(r => setActivities(Array.isArray(r) ? r : [])).catch(() => undefined);
  }, []);

  const set = (patch: Partial<PriceDraft>) => onDraft({ ...draft, ...patch });
  const areas = storage.storage.filter(s => s.storageType === 'AREA');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setDone('');
    try {
      const r = await apiRequest<{ recordsPriced: number; quantityAffected: number }>('cost:setPriceByScope', {
        scopeType: draft.scopeType, scopeRef: draft.scopeRef.trim(), itemId: draft.itemId.trim(), unitCost: Number(unitCost), reason: reason.trim()
      });
      setDone(`Priced ${r.recordsPriced} record(s), ${r.quantityAffected} unit(s) affected. The change is in the price-change log.`);
      setUnitCost(''); setReason('');
    } catch (err: any) {
      setError(err.message || 'Setting the price failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card shadow-sm border-0" style={{ maxWidth: '640px' }}>
      <div className="card-body p-4">
        <p className="small text-muted">Fills in a price for stock or charges that have <strong>no price (₱0)</strong>. A price that is already set is never changed here. Every change is logged with your name and reason.</p>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {done && <div className="alert alert-success py-2 small">{done}</div>}
        <div className="row g-3">
          <div className="col-md-5">
            <label className="form-label small fw-semibold">Scope *</label>
            <select className="form-select form-select-sm" value={draft.scopeType} onChange={e => set({ scopeType: e.target.value, scopeRef: '' })}>
              <option value="WAREHOUSE">Stock in a warehouse</option>
              <option value="AREA">Stock in an area</option>
              <option value="ACTIVITY">Charges on an activity</option>
              <option value="CUSTODIAN">Tools held by a custodian</option>
            </select>
          </div>
          <div className="col-md-7">
            <label className="form-label small fw-semibold">{draft.scopeType === 'WAREHOUSE' ? 'Warehouse' : draft.scopeType === 'AREA' ? 'Area' : draft.scopeType === 'ACTIVITY' ? 'Activity' : 'Custodian ID'} *</label>
            {draft.scopeType === 'WAREHOUSE' && (
              <select className="form-select form-select-sm" required value={draft.scopeRef} onChange={e => set({ scopeRef: e.target.value })}>
                <option value="">Select…</option>
                {storage.warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.id})</option>)}
              </select>
            )}
            {draft.scopeType === 'AREA' && (
              <select className="form-select form-select-sm" required value={draft.scopeRef} onChange={e => set({ scopeRef: e.target.value })}>
                <option value="">Select…</option>
                {areas.map(a => <option key={a.storageId} value={a.storageId}>{a.name} ({a.storageId})</option>)}
              </select>
            )}
            {draft.scopeType === 'ACTIVITY' && (
              <select className="form-select form-select-sm" required value={draft.scopeRef} onChange={e => set({ scopeRef: e.target.value })}>
                <option value="">Select…</option>
                {activities.map(a => <option key={a.Activity_ID} value={a.Activity_ID}>{a.Activity_ID} — {a.Activity_Name}</option>)}
              </select>
            )}
            {draft.scopeType === 'CUSTODIAN' && (
              <input className="form-control form-control-sm font-monospace" required value={draft.scopeRef} onChange={e => set({ scopeRef: e.target.value })} />
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Item ID *</label>
            <input className="form-control form-control-sm font-monospace" required value={draft.itemId} onChange={e => set({ itemId: e.target.value })} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Unit cost *</label>
            <div className="input-group input-group-sm"><span className="input-group-text">₱</span>
              <input type="number" min="0" step="0.01" className="form-control" required value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
          </div>
          <div className="col-12">
            <label className="form-label small fw-semibold">Reason *</label>
            <input className="form-control form-control-sm" required placeholder="e.g. Supplier invoice received" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
        <div className="d-flex justify-content-end mt-4">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Set price'}</button>
        </div>
      </div>
    </form>
  );
};
