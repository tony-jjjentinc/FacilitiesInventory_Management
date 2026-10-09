import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { invalidateCache } from '../../services/cache';
import { ConfirmModal } from '../ConfirmModal';
import type { ReceiptLineRecord, ReceiptRecord } from '../../types';
import { prefetchMrls } from './useMrlList';

interface Props {
  active: boolean;
  refreshKey: number;
  onCountChange: (awaitingMe: number) => void;
}

type View = 'awaiting' | 'unpriced' | 'all';

export const PendingConfirmations: React.FC<Props> = ({ active, refreshKey, onCountChange }) => {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [view, setView] = useState<View>('awaiting');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openId, setOpenId] = useState('');
  const [confirming, setConfirming] = useState<ReceiptRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await apiRequest<ReceiptRecord[]>('receiving:getPending', { status: 'ALL' });
      const list = Array.isArray(rows) ? rows : [];
      setReceipts(list);
      onCountChange(list.filter(r => r.canConfirm).length);
    } catch (err: any) {
      setError(err.message || 'Failed to load receipts.');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { if (active) load(); }, [active, load]);

  const unpricedLines = (r: ReceiptRecord) => r.items.filter(l => l.Line_Status === 'VERIFIED' && l.Price_Status === 'PENDING');

  const visible = useMemo(() => receipts.filter(r => {
    if (view === 'awaiting') return r.Status === 'PENDING_CONFIRMATION';
    if (view === 'unpriced') return r.Status !== 'CANCELLED' && unpricedLines(r).length > 0;
    return true;
  }), [receipts, view]);

  const afterChange = async (msg: string) => {
    invalidateCache('inventory:stock');
    invalidateCache('transaction:history');
    invalidateCache('activity');
    prefetchMrls(); // a confirmed or cancelled receipt changes which MRLs are available
    setNotice(msg);
    await load();
  };

  const confirm = async () => {
    if (!confirming) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<{ transactionId: string | null; mrtNumber: string | null }>('receiving:confirm', { receiptId: confirming.Receipt_ID });
      setConfirming(null);
      await afterChange(`Receipt ${confirming.Receipt_ID} confirmed.${res.transactionId ? ` Transaction ${res.transactionId}.` : ''}${res.mrtNumber ? ` MRT ${res.mrtNumber}.` : ''}`);
    } catch (err: any) {
      setConfirming(null);
      setError(err.message || 'Confirmation failed.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (r: ReceiptRecord) => {
    const reason = window.prompt(`Cancel receipt ${r.Receipt_ID}? Optional reason:`, '');
    if (reason === null) return;
    setError('');
    try {
      await apiRequest('receiving:cancel', { receiptId: r.Receipt_ID, reason });
      await afterChange(`Receipt ${r.Receipt_ID} cancelled.`);
    } catch (err: any) {
      setError(err.message || 'Cancel failed.');
    }
  };

  const savePrice = async (l: ReceiptLineRecord) => {
    const cost = Number(priceInputs[l.Receipt_Line_ID]);
    if (!isFinite(cost) || cost <= 0) { setError('Enter a unit cost above 0.'); return; }
    setError('');
    try {
      const res = await apiRequest<{ corrected: string }>('receiving:setLinePrice', { receiptLineId: l.Receipt_Line_ID, unitCost: cost });
      await afterChange(`Price saved (${res.corrected}). Units already issued keep the cost they were issued at.`);
    } catch (err: any) {
      setError(err.message || 'Saving the price failed.');
    }
  };

  const statusBadge = (s: ReceiptRecord['Status']) =>
    s === 'PENDING_CONFIRMATION' ? 'bg-warning-subtle text-warning-emphasis border'
      : s === 'CONFIRMED' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border';

  return (
    <div>
      {notice && <div className="alert alert-success py-2 small" role="status">{notice}</div>}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3 border-0 d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
          <div>
            <h6 className="fw-bold text-dark mb-0">Receipts</h6>
            <small className="text-secondary">Confirm receipts that name you, and price items that were received without a price.</small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group">
              {([['awaiting', 'Awaiting confirmation'], ['unpriced', 'Unpriced'], ['all', 'All']] as [View, string][]).map(([v, label]) => (
                <button key={v} type="button" className={`btn ${view === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView(v)}>{label}</button>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>Refresh</button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="table-light">
              <tr><th>Receipt</th><th>Source</th><th>Destination</th><th>Receiving party</th><th>Status</th><th className="text-end">Actions</th></tr>
            </thead>
            <tbody>
              {loading && receipts.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Loading</td></tr>}
              {!loading && visible.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Nothing here.</td></tr>}
              {visible.map(r => {
                const open = openId === r.Receipt_ID;
                const unpriced = unpricedLines(r);
                return (
                  <React.Fragment key={r.Receipt_ID}>
                    <tr>
                      <td>
                        <span className="font-monospace fw-semibold text-dark">{r.Receipt_ID}</span>
                        <div className="small text-muted">{r.Submitted_At} · {r.Submitted_By_ID}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{r.Source_Type}</span>
                        <div className="small text-muted">
                          {r.Source_Type === 'MRL' ? `MRL ${r.Source_Reference} · MRQ ${r.MRQ_Number}` : r.Source_Reference}
                        </div>
                        {r.Project_Name && <div className="small text-muted">{r.Project_Name}</div>}
                      </td>
                      <td>
                        {r.Destination_Type === 'ACTIVITY'
                          ? <>Activity <span className="font-monospace">{r.Activity_ID}</span></>
                          : <>Warehouse <span className="font-monospace">{r.Warehouse_Location}</span>{r.Area_ID ? <div className="small text-muted font-monospace">{r.Area_ID}</div> : null}</>}
                      </td>
                      <td>{r.Receiver_ID}</td>
                      <td>
                        <span className={`badge ${statusBadge(r.Status)}`}>{r.Status === 'PENDING_CONFIRMATION' ? 'Pending' : r.Status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}</span>
                        {r.Status === 'CONFIRMED' && <div className="small text-muted">{r.Confirmed_At}</div>}
                      </td>
                      <td className="text-end text-nowrap">
                        <button type="button" className="btn btn-outline-secondary btn-sm me-1" onClick={() => setOpenId(open ? '' : r.Receipt_ID)}>
                          {open ? 'Hide items' : `Items (${r.items.length})`}
                        </button>
                        {r.Status === 'PENDING_CONFIRMATION' && r.canConfirm && (
                          <button type="button" className="btn btn-success btn-sm me-1" onClick={() => setConfirming(r)}>Confirm receipt</button>
                        )}
                        {r.Status === 'PENDING_CONFIRMATION' && (
                          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => cancel(r)}>Cancel</button>
                        )}
                      </td>
                    </tr>

                    {open && (
                      <tr className="table-light">
                        <td colSpan={6}>
                          <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
                            <thead><tr><th>Item</th><th className="text-end">Released</th><th className="text-end">Received</th><th>UOM</th><th className="text-end">Unit cost</th><th>Result</th></tr></thead>
                            <tbody>
                              {r.items.map(l => (
                                <tr key={l.Receipt_Line_ID} className={l.Line_Status === 'REJECTED' ? 'table-danger-subtle' : ''}>
                                  <td><span className="font-monospace">{l.Item_ID}</span> {l.Item_Name}</td>
                                  <td className="text-end">{l.Released_Qty === '' ? '—' : l.Released_Qty}</td>
                                  <td className="text-end">{l.Line_Status === 'VERIFIED' ? l.Received_Qty : '—'}</td>
                                  <td>{l.UOM}</td>
                                  <td className="text-end">{l.Line_Status === 'VERIFIED' ? (l.Price_Status === 'PENDING' ? <span className="badge bg-warning-subtle text-warning-emphasis border">no price</span> : `₱${Number(l.Unit_Cost).toFixed(2)}`) : '—'}</td>
                                  <td>{l.Line_Status === 'VERIFIED' ? 'Receive' : `Invalid: ${l.Mismatch_Details}`}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {r.Status === 'CONFIRMED' && <div className="small text-muted mt-2">{r.Transaction_ID}{r.MRT_Number ? ` · ${r.MRT_Number}` : ''}</div>}
                        </td>
                      </tr>
                    )}

                    {view === 'unpriced' && unpriced.length > 0 && (
                      <tr>
                        <td colSpan={6} className="bg-white">
                          <div className="small fw-semibold mb-1">Set the missing price</div>
                          {r.Status === 'CONFIRMED' && <div className="small text-muted mb-2">Corrects the ledger line and the value still on hand. Units already issued keep the cost they were issued at.</div>}
                          {unpriced.map(l => (
                            <div key={l.Receipt_Line_ID} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                              <span className="small flex-grow-1"><span className="font-monospace">{l.Item_ID}</span> {l.Item_Name} × {l.Received_Qty}</span>
                              <div className="input-group input-group-sm" style={{ maxWidth: '180px' }}>
                                <span className="input-group-text">₱</span>
                                <input type="number" min="0" step="0.01" className="form-control" aria-label="Unit cost" value={priceInputs[l.Receipt_Line_ID] || ''}
                                  onChange={e => setPriceInputs({ ...priceInputs, [l.Receipt_Line_ID]: e.target.value })} />
                              </div>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => savePrice(l)}>Save price</button>
                            </div>
                          ))}
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

      <ConfirmModal
        isOpen={!!confirming}
        title="Confirm receipt"
        message={confirming ? `Confirm that you received the items on ${confirming.Receipt_ID}? This posts the stock${confirming.Destination_Type === 'ACTIVITY' ? ` to activity ${confirming.Activity_ID}` : ` into ${confirming.Warehouse_Location}`} and cannot be undone here.` : ''}
        confirmText="Yes, items received"
        isLoading={busy}
        onConfirm={confirm}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
};
