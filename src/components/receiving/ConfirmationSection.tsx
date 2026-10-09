import React from 'react';
import type { OpenActivity, ReceivingLine, ReceivingParty, StorageOptions } from '../../types';
import { StepCard } from './StepCard';
import { getCurrentUser } from '../../services/auth';
import { DUMMY_RECEIVING_PARTIES } from './receivingParties';
import { activityLabel, nodeLabel } from './receivingUtils';

interface Props {
  title: string;
  /** What is being received, e.g. "MRL 6506" or "Petty cash purchase PCV-12" */
  reference: string;
  lines: ReceivingLine[];
  party: ReceivingParty;
  storage: StorageOptions;
  activities: OpenActivity[];
  busy: boolean;
  onClear: () => void;
  onSubmit: () => void;
}

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Overview of what will be enrolled in the system, and the button that sends it to the receiving party. */
export const ConfirmationSection: React.FC<Props> = ({ title, reference, lines, party, storage, activities, busy, onClear, onSubmit }) => {
  const verified = lines.filter(l => l.lineStatus === 'VERIFIED');
  const returned = lines.filter(l => l.lineStatus === 'REJECTED');
  const amount = (l: ReceivingLine) => (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0);
  const total = verified.reduce((s, l) => s + amount(l), 0);
  const unpriced = verified.filter(l => (Number(l.unitCost) || 0) === 0).length;

  const warehouse = storage.warehouses.find(w => w.id === party.warehouseLocation);
  const area = storage.storage.find(n => n.storageId === party.areaId);
  const activity = activities.find(a => a.Activity_ID === party.activityId);
  const destination = party.destinationType === 'ACTIVITY'
    ? `Direct to activity ${activity ? activityLabel(activity) : party.activityId}`
    : `Warehouse ${warehouse?.name || party.warehouseLocation}${area ? ` · ${nodeLabel(area)}` : ''}`;

  const fact = (label: string, value: React.ReactNode) => (
    <div className="col-12 col-md-4">
      <div className="text-secondary" style={{ fontSize: '0.72rem' }}>{label}</div>
      <div className="small text-dark text-break">{value || '—'}</div>
    </div>
  );

  return (
    <StepCard title={title} hint="Overview of the items that will be enrolled in the system.">
      <div className="row g-3 mb-3">
        {fact('Reference', reference)}
        {fact('Destination', destination)}
        {fact('Receiving party', (() => { const p = DUMMY_RECEIVING_PARTIES.find(x => x.email === party.receiverId.trim().toLowerCase()); return p ? `${p.name} (${p.email})` : party.receiverId.trim().toLowerCase() === (getCurrentUser()?.email || '').toLowerCase() ? `Myself (${party.receiverId.trim()})` : party.receiverId.trim(); })())}
      </div>

      <div className="table-responsive border rounded">
        <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
          <thead className="table-light">
            <tr><th>Item</th><th className="text-end">Quantity</th><th className="text-end">Unit Cost</th><th className="text-end">Amount</th></tr>
          </thead>
          <tbody>
            {verified.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-3">No items to enroll yet.</td></tr>}
            {verified.map(l => (
              <tr key={l.key}>
                <td>
                  <div className="text-dark">{l.itemName}</div>
                  <div className="small text-muted font-monospace">{l.itemId}</div>
                </td>
                <td className="text-end">{l.receivedQty} {l.uom}</td>
                <td className="text-end">{Number(l.unitCost) > 0 ? peso(Number(l.unitCost)) : <span className="text-warning-emphasis">To be priced</span>}</td>
                <td className="text-end">{Number(l.unitCost) > 0 ? peso(amount(l)) : '—'}</td>
              </tr>
            ))}
          </tbody>
          {verified.length > 0 && (
            <tfoot>
              <tr className="table-light">
                <td colSpan={3} className="text-end fw-semibold">Total</td>
                <td className="text-end fw-semibold">{peso(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {unpriced > 0 && (
        <div className="small text-warning-emphasis mt-2">
          {unpriced} item{unpriced > 1 ? 's have' : ' has'} no price and will be received at ₱0 until a Head or Super Admin sets it.
        </div>
      )}
      {returned.length > 0 && (
        <div className="small text-secondary mt-2">
          <strong className="text-dark">{returned.length}</strong> item{returned.length > 1 ? 's' : ''} returned to ProcInv on an MRT:{' '}
          {returned.map(l => l.itemName).join(', ')}.
        </div>
      )}

      <div className="alert alert-info py-2 small mt-3 mb-0">
        {party.autoReceive ? <>The items are received into the inventory as soon as you submit.</> : <>Nothing changes in the inventory yet.{party.receiverId.trim() ? <> <strong>{party.receiverId.trim()}</strong> must confirm receipt with their own login first.</> : ' The receiving party must confirm receipt with their own login first.'}</>}
      </div>

      <div className="d-flex justify-content-end gap-2 border-top pt-3 mt-3">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClear} disabled={busy}>Clear</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit} disabled={busy}>{busy ? 'Submitting…' : party.autoReceive ? 'Submit and receive' : 'Submit for confirmation'}</button>
      </div>
    </StepCard>
  );
};
