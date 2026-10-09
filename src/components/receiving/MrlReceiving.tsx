import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { getCurrentUser } from '../../services/auth';
import type { MrlDetails, ReceivingLine, ReceivingParty, StagedMrlSummary } from '../../types';
import { MrlPickerModal } from './MrlPickerModal';
import { ReceivingLinesSection } from './ReceivingLinesSection';
import { ReceivingPartySection } from './ReceivingPartySection';
import { StepCard } from './StepCard';
import { SubmitBar } from './SubmitBar';
import { ReceivingReviewModal } from './ReceivingReviewModal';
import { buildPayload, newLineKey, priceFields, spotsInArea, validateReceiving } from './receivingUtils';
import type { useReceivingLookups } from './useReceivingLookups';

interface Props {
  lookups: ReturnType<typeof useReceivingLookups>;
  onSubmitted: () => void;
  onViewPending: () => void;
}

const EMPTY_PARTY: ReceivingParty = { destinationType: 'WAREHOUSE', activityId: '', warehouseLocation: '', areaId: '', receiverId: '', remarks: '' };

export const MrlReceiving: React.FC<Props> = ({ lookups, onSubmitted, onViewPending }) => {
  const me = getCurrentUser()?.email || '';
  const [mrlNumber, setMrlNumber] = useState('');
  const [mrqNumber, setMrqNumber] = useState('');
  const [details, setDetails] = useState<MrlDetails | null>(null);
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [party, setParty] = useState<ReceivingParty>(EMPTY_PARTY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ receiptId: string; receiverId: string; verifiedCount: number; rejectedCount: number } | null>(null);

  // default warehouse once the lookups have loaded
  useEffect(() => {
    if (!party.warehouseLocation && lookups.storage.warehouses.length > 0) {
      setParty(p => ({ ...p, warehouseLocation: lookups.storage.warehouses[0].id }));
    }
  }, [lookups.storage.warehouses, party.warehouseLocation]);

  const spotOptions = useMemo(
    () => (party.destinationType === 'WAREHOUSE' ? spotsInArea(lookups.storage.storage, party.areaId) : []),
    [lookups.storage.storage, party.areaId, party.destinationType]
  );

  const loadDetails = async (number: string, mrq?: string) => {
    if (!number.trim()) { setError('Enter or select an MRL number.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const d = await apiRequest<MrlDetails>('receiving:getMrlDetails', { mrlNumber: number.trim(), mrqNumber: mrq || '' });
      setDetails(d);
      setMrlNumber(d.mrl.mrlNumber);
      setMrqNumber(d.mrq.mrqNumber);
      setLines(d.lines.map(l => ({
        key: newLineKey(), lineNo: l.lineNo, itemId: l.itemId, itemName: l.itemName, mapped: l.mapped,
        requestedQty: l.requestedQty, releasedQty: l.releasedQty, receivedQty: String(l.releasedQty), uom: l.uom,
        ...priceFields({ ...l.price, options: l.priceOptions }), serialNumber: '', storageId: '',
        lineStatus: l.mapped ? 'VERIFIED' : 'REJECTED', mismatchDetails: l.mapped ? '' : 'Item not in the catalog / does not match the request'
      })));
      setParty(p => ({ ...p, activityId: d.suggestedActivity?.activityId || '' }));
    } catch (err: any) {
      setDetails(null);
      setLines([]);
      setError(err.message || 'Failed to load the MRL.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDetails(null); setLines([]); setMrlNumber(''); setMrqNumber('');
    setParty({ ...EMPTY_PARTY, warehouseLocation: lookups.storage.warehouses[0]?.id || '' });
  };

  const review = () => {
    const problem = validateReceiving('MRL', mrlNumber, lines, party, me);
    if (!details) { setError('Fetch the MRL first.'); return; }
    if (problem) { setError(problem); return; }
    setError('');
    setReviewOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await apiRequest<{ receiptId: string; receiverId: string; verifiedCount: number; rejectedCount: number }>(
        'receiving:submit', buildPayload('MRL', mrlNumber, details, lines, party));
      setResult(res);
      setReviewOpen(false);
      resetForm();
      onSubmitted();
    } catch (err: any) {
      setReviewOpen(false);
      setError(err.message || 'Submitting the receipt failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const q = details?.mrq;
  const m = details?.mrl;
  const fact = (label: string, value: React.ReactNode) => (
    <div className="col-6 col-md-3">
      <div className="text-secondary" style={{ fontSize: '0.72rem' }}>{label}</div>
      <div className="small text-dark">{value || '—'}</div>
    </div>
  );

  return (
    <div>
      {result && (
        <div className="alert alert-success py-2 small" role="status">
          Receipt <strong>{result.receiptId}</strong> submitted: {result.verifiedCount} item(s) to receive, {result.rejectedCount} invalid.
          Waiting for <strong>{result.receiverId}</strong> to confirm.{' '}
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onViewPending}>View pending receipts</button>
        </div>
      )}
      {(error || lookups.error) && <div className="alert alert-danger py-2 small">{error || lookups.error}</div>}

      <StepCard title="MRL" hint="Type the MRL number, or browse the released MRLs that are not received yet.">
        <div className="row g-2 align-items-end">
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">MRL number</label>
            <input className="form-control form-control-sm font-monospace" value={mrlNumber}
              onChange={e => { setMrlNumber(e.target.value); setMrqNumber(''); }}
              onKeyDown={e => { if (e.key === 'Enter') loadDetails(mrlNumber, mrqNumber); }} />
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => loadDetails(mrlNumber, mrqNumber)} disabled={loading}>
              {loading ? 'Loading' : 'Fetch'}
            </button>
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPickerOpen(true)}>Browse MRLs</button>
          </div>
        </div>
      </StepCard>

      {details && q && m && (
        <>
          <StepCard title="1. Delivery" hint="From the staged MRQ and MRL.">
            <div className="row g-3">
              {fact('MRL', <span className="font-monospace">{m.mrlNumber}</span>)}
              {fact('MRQ', <span className="font-monospace">{q.mrqNumber}</span>)}
              {fact('Integr8 GI', m.integr8GiNumber)}
              {fact('Released', [m.releasedAt, m.batchNumber].filter(Boolean).join(' · '))}
              {fact('Project', q.activityName)}
              {fact('Classification No.', <span className="font-monospace">{q.classificationId}</span>)}
              {fact('Location', [q.location, q.costCenter].filter(Boolean).join(' · '))}
              {fact('Requested by', [q.requestedBy, q.department].filter(Boolean).join(' · '))}
              {fact('Purpose', q.purpose)}
              {fact('Requested', [q.dateRequested, q.dateRequired && `needed ${q.dateRequired}`].filter(Boolean).join(' · '))}
              {fact('Activity in system', details.suggestedActivity
                ? <span className="text-success">{details.suggestedActivity.activityId} — {details.suggestedActivity.activityName}</span>
                : <span className="text-warning-emphasis">none with this Classification No.</span>)}
            </div>
          </StepCard>

          <ReceivingLinesSection mode="MRL" title="2. Items" hint="Mark each item Receive or Invalid. Invalid items go back to ProcInv on an MRT."
            lines={lines} onChange={setLines} spotOptions={spotOptions} allStorage={lookups.storage.storage} />

          <ReceivingPartySection title="3. Receiving" party={party} onChange={setParty} storage={lookups.storage} activities={lookups.activities}
            details={details} suggested={details.suggestedActivity} onActivityCreated={lookups.reloadActivities} />

          <SubmitBar lines={lines} onClear={resetForm} onReview={review} />
        </>
      )}

      <MrlPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)}
        onSelect={(s: StagedMrlSummary) => { setPickerOpen(false); loadDetails(s.mrlNumber, s.mrqNumber); }} />
      <ReceivingReviewModal open={reviewOpen} title={`Review MRL ${mrlNumber}`} reference={mrlNumber} lines={lines} party={party}
        busy={submitting} onConfirm={submit} onCancel={() => setReviewOpen(false)} />
    </div>
  );
};
