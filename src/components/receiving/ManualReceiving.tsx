import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { notifySubmit, submitStatusText, type SubmitResult } from './submitFeedback';
import { getCurrentUser } from '../../services/auth';
import type { ReceivingLine, ReceivingParty, ReceivingSourceType } from '../../types';
import { ManualItemModal } from './ManualItemModal';
import { ReceivingLinesSection } from './ReceivingLinesSection';
import { ReceivingPartySection } from './ReceivingPartySection';
import { StepCard } from './StepCard';
import { ConfirmationSection } from './ConfirmationSection';
import { buildPayload, spotsInArea, validateReceiving } from './receivingUtils';
import type { useReceivingLookups } from './useReceivingLookups';

interface Props {
  lookups: ReturnType<typeof useReceivingLookups>;
  onSubmitted: () => void;
  onViewPending: () => void;
}

const EMPTY_PARTY: ReceivingParty = { destinationType: 'WAREHOUSE', activityId: '', warehouseLocation: '', areaId: '', receiverId: '', autoReceive: false, remarks: '' };

const SOURCES: { value: ReceivingSourceType; label: string; hint: string }[] = [
  { value: 'MANUAL', label: 'Manual entry', hint: 'Entry reference (old or unaccounted stock)' },
  { value: 'PETTY_CASH', label: 'Petty cash purchase', hint: 'Petty cash voucher / receipt no.' },
  { value: 'RF', label: 'Requisition Form (RF)', hint: 'RF number' },
  { value: 'RFP', label: 'Request for Payment (RFP)', hint: 'RFP number' }
];

export const ManualReceiving: React.FC<Props> = ({ lookups, onSubmitted, onViewPending }) => {
  const me = getCurrentUser()?.email || '';
  const [sourceType, setSourceType] = useState<ReceivingSourceType>('MANUAL');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [party, setParty] = useState<ReceivingParty>(EMPTY_PARTY);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    if (!party.warehouseLocation && lookups.storage.warehouses.length > 0) {
      setParty(p => ({ ...p, warehouseLocation: lookups.storage.warehouses[0].id }));
    }
  }, [lookups.storage.warehouses, party.warehouseLocation]);

  const spotOptions = useMemo(
    () => (party.destinationType === 'WAREHOUSE' ? spotsInArea(lookups.storage.storage, party.areaId) : []),
    [lookups.storage.storage, party.areaId, party.destinationType]
  );
  const source = SOURCES.find(s => s.value === sourceType)!;

  const review = () => {
    const problem = validateReceiving('MANUAL', reference, lines, party, me);
    if (problem) { toast.error(problem); return; }
    submit();
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await apiRequest<SubmitResult>(
        'receiving:submit', buildPayload(sourceType, reference, null, lines, party));
      setResult(res);
      notifySubmit(res, toast);
      setLines([]);
      setReference('');
      setParty({ ...EMPTY_PARTY, warehouseLocation: lookups.storage.warehouses[0]?.id || '' });
      onSubmitted();
    } catch (err: any) {
      toast.error(err.message || 'Submitting the receipt failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {result && (
        <div className="alert alert-success py-2 small" role="status">
          Receipt <strong>{result.receiptId}</strong> submitted: {result.verifiedCount} item(s). {submitStatusText(result)}{' '}
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onViewPending}>View pending receipts</button>
        </div>
      )}

      <StepCard title="1. Source" hint="Where the items came from.">
        <div className="row g-3">
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">Source type</label>
            <select className="form-select form-select-sm" value={sourceType} onChange={e => setSourceType(e.target.value as ReceivingSourceType)}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="col-md-7">
            <label className="form-label small fw-semibold mb-1">Reference number</label>
            <input className="form-control form-control-sm font-monospace" value={reference} onChange={e => setReference(e.target.value)} />
            <div className="form-text">{source.hint}</div>
          </div>
        </div>
      </StepCard>

      <ReceivingLinesSection mode="MANUAL" title="2. Items" hint="Add each item that was received, then adjust quantity and price here."
        actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>Add item</button>}
        lines={lines} onChange={setLines} spotOptions={spotOptions} allStorage={lookups.storage.storage} />
      <ReceivingPartySection title="3. Receiving" party={party} onChange={setParty} storage={lookups.storage} activities={lookups.activities}
        details={null} suggested={null} onActivityCreated={lookups.reloadActivities} />
          <ConfirmationSection title="4. Confirmation" reference={`${source.label} ${reference}`} lines={lines} party={party} storage={lookups.storage} activities={lookups.activities}
            busy={submitting} onClear={() => { setLines([]); setReference(''); }} onSubmit={review} />

      <ManualItemModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={line => setLines(prev => [...prev, line])} />
    </div>
  );
};
