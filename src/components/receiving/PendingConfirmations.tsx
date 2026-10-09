import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { invalidateCache } from '../../services/cache';
import { ConfirmModal } from '../ConfirmModal';
import type { ReceiptLineRecord, ReceiptRecord } from '../../types';
import { prefetchMrls } from './useMrlList';
import { useToast } from '../../context/ToastContext';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';

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
  const toast = useToast();
  const [openId, setOpenId] = useState('');
  const [confirming, setConfirming] = useState<ReceiptRecord | null>(null);
  const [cancelling, setCancelling] = useState<ReceiptRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiRequest<ReceiptRecord[]>('receiving:getPending', { status: 'ALL' });
      const list = Array.isArray(rows) ? rows : [];
      setReceipts(list);
      onCountChange(list.filter(r => r.canConfirm).length);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load receipts.');
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
    toast.success(msg);
    await load();
  };

  const confirm = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ transactionId: string | null; mrtNumber: string | null }>('receiving:confirm', { receiptId: confirming.Receipt_ID });
      setConfirming(null);
      await afterChange(`Receipt ${confirming.Receipt_ID} confirmed.${res.transactionId ? ` Transaction ${res.transactionId}.` : ''}${res.mrtNumber ? ` MRT ${res.mrtNumber}.` : ''}`);
    } catch (err: any) {
      setConfirming(null);
      toast.error(err.message || 'Confirmation failed.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await apiRequest('receiving:cancel', { receiptId: cancelling.Receipt_ID, reason: cancelReason.trim() });
      const id = cancelling.Receipt_ID;
      setCancelling(null);
      setCancelReason('');
      await afterChange(`Receipt ${id} cancelled.`);
    } catch (err: any) {
      setCancelling(null);
      toast.error(err.message || 'Cancel failed.');
    } finally {
      setBusy(false);
    }
  };

  const savePrice = async (l: ReceiptLineRecord) => {
    const cost = Number(priceInputs[l.Receipt_Line_ID]);
    if (!isFinite(cost) || cost <= 0) { toast.error('Enter a unit cost above 0.'); return; }
    try {
      const res = await apiRequest<{ corrected: string }>('receiving:setLinePrice', { receiptLineId: l.Receipt_Line_ID, unitCost: cost });
      await afterChange(`Price saved (${res.corrected}). Units already issued keep the cost they were issued at.`);
    } catch (err: any) {
      toast.error(err.message || 'Saving the price failed.');
    }
  };

  const statusBadge = (st: ReceiptRecord['Status']) =>
    st === 'PENDING_CONFIRMATION' ? 'bg-warning-subtle text-warning-emphasis border'
      : st === 'CONFIRMED' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border';

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(r => [r.Receipt_ID, r.Source_Reference, r.MRQ_Number, r.Project_Name, r.Receiver_ID, r.Submitted_By_ID, r.Activity_ID, r.Warehouse_Location].join(' ').toLowerCase().includes(q));
  }, [visible, search]);

  const columns: Column<ReceiptRecord>[] = [
    { key: 'Receipt_ID', label: 'Receipt', sortable: true, minWidth: '170px', render: r => (
      <div><span className="font-monospace fw-semibold text-dark">{r.Receipt_ID}</span><div className="small text-muted">{r.Submitted_At} · {r.Submitted_By_ID}</div></div>
    ) },
    { key: 'Source_Type', label: 'Source', sortable: true, minWidth: '180px', render: r => (
      <div>
        <span className="badge bg-light text-dark border">{r.Source_Type}</span>
        <div className="small text-muted">{r.Source_Type === 'MRL' ? `MRL ${r.Source_Reference} · MRQ ${r.MRQ_Number}` : r.Source_Reference}</div>
        {r.Project_Name && <div className="small text-muted">{r.Project_Name}</div>}
      </div>
    ) },
    { key: 'Destination_Type', label: 'Destination', minWidth: '170px', render: r => (
      r.Destination_Type === 'ACTIVITY'
        ? <>Activity <span className="font-monospace">{r.Activity_ID}</span></>
        : <>Warehouse <span className="font-monospace">{r.Warehouse_Location}</span>{r.Area_ID ? <div className="small text-muted font-monospace">{r.Area_ID}</div> : null}</>
    ) },
    { key: 'Receiver_ID', label: 'Receiving party', sortable: true, minWidth: '160px' },
    { key: 'Status', label: 'Status', sortable: true, minWidth: '110px', render: r => (
      <div>
        <span className={`badge ${statusBadge(r.Status)}`}>{r.Status === 'PENDING_CONFIRMATION' ? 'Pending' : r.Status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}</span>
        {r.Status === 'CONFIRMED' && <div className="small text-muted">{r.Confirmed_At}</div>}
      </div>
    ) },
    { key: 'actions', label: 'Actions', align: 'right', minWidth: '260px', render: r => (
      <div className="text-nowrap">
        <button type="button" className="btn btn-outline-secondary btn-sm me-1" onClick={() => setOpenId(openId === r.Receipt_ID ? '' : r.Receipt_ID)}>
          {openId === r.Receipt_ID ? 'Hide items' : `Items (${r.items.length})`}
        </button>
        {r.Status === 'PENDING_CONFIRMATION' && r.canConfirm && (
          <button type="button" className="btn btn-success btn-sm me-1" onClick={() => setConfirming(r)}>Confirm receipt</button>
        )}
        {r.Status === 'PENDING_CONFIRMATION' && (
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setCancelling(r)}>Cancel</button>
        )}
      </div>
    ) }
  ];

  const expanded = (r: ReceiptRecord) => {
    const open = openId === r.Receipt_ID;
    const unpriced = view === 'unpriced' ? unpricedLines(r) : [];
    if (!open && unpriced.length === 0) return null;
    return (
      <>
        {open && (
          <div className="py-2">
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
          </div>
        )}
        {unpriced.length > 0 && (
          <div className="py-2">
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
          </div>
        )}
      </>
    );
  };

  return (
    <div>

      <DataCard<ReceiptRecord>
        title="Receipts"
        description="Confirm receipts that name you, and price items that were received without a price."
        onRefresh={load}
        refreshing={loading}
        tabs={[
          { key: 'awaiting', label: 'Awaiting confirmation' },
          { key: 'unpriced', label: 'Unpriced' },
          { key: 'all', label: 'All' }
        ]}
        activeTab={view}
        onTabChange={k => setView(k as View)}
        columns={columns}
        data={shown}
        keyField="Receipt_ID"
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by receipt, MRL, project, person..."
        isLoading={loading && receipts.length === 0}
        emptyMessage="Nothing here."
        renderExpanded={expanded}
      />

      <ConfirmModal
        isOpen={!!confirming}
        title="Confirm receipt"
        message={confirming ? `Confirm that you received the items on ${confirming.Receipt_ID}? This posts the stock${confirming.Destination_Type === 'ACTIVITY' ? ` to activity ${confirming.Activity_ID}` : ` into ${confirming.Warehouse_Location}`} and cannot be undone here.` : ''}
        confirmText="Yes, items received"
        isLoading={busy}
        onConfirm={confirm}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmModal
        isOpen={!!cancelling}
        title="Cancel receipt"
        message={cancelling ? `Cancel receipt ${cancelling.Receipt_ID}? Nothing has been posted to stock yet.` : ''}
        confirmText="Cancel receipt"
        cancelText="Keep"
        isDanger
        isLoading={busy}
        onConfirm={cancel}
        onCancel={() => { setCancelling(null); setCancelReason(''); }}
      >
        <label className="form-label small fw-semibold mt-3 mb-1" htmlFor="cancel-reason">Reason (optional)</label>
        <input id="cancel-reason" className="form-control form-control-sm" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
      </ConfirmModal>
    </div>
  );
};
