import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { notifySubmit, submitStatusText, type SubmitResult } from './submitFeedback';
import { canAddToCatalog, getCurrentUser } from '../../services/auth';
import type { MrlDetails, ReceivingLine, ReceivingParty, StagedMrlSummary } from '../../types';
import { ConfirmModal } from '../ConfirmModal';
import { MrlPickerModal } from './MrlPickerModal';
import { AddCatalogItemModal } from './AddCatalogItemModal';
import { ReceivingLinesSection } from './ReceivingLinesSection';
import { ReceivingPartySection } from './ReceivingPartySection';
import { StepCard } from './StepCard';
import { ConfirmationSection } from './ConfirmationSection';
import { buildPayload, newLineKey, priceFields, simpleDate, spotsInArea, validateReceiving } from './receivingUtils';
import type { useReceivingLookups } from './useReceivingLookups';

interface Props {
  lookups: ReturnType<typeof useReceivingLookups>;
  onSubmitted: () => void;
  onViewPending: () => void;
}

const EMPTY_PARTY: ReceivingParty = { destinationType: 'WAREHOUSE', activityId: '', warehouseLocation: '', areaId: '', receiverId: '', autoReceive: false, remarks: '' };

export const MrlReceiving: React.FC<Props> = ({ lookups, onSubmitted, onViewPending }) => {
  const me = getCurrentUser()?.email || '';
  const [mrlNumber, setMrlNumber] = useState('');
  const [mrqNumber, setMrqNumber] = useState('');
  const [details, setDetails] = useState<MrlDetails | null>(null);
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [party, setParty] = useState<ReceivingParty>(EMPTY_PARTY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalogLine, setCatalogLine] = useState<ReceivingLine | null>(null);
  const mayAddToCatalog = canAddToCatalog(getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const [result, setResult] = useState<SubmitResult | null>(null);

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

  // Fetching another MRL replaces the one being staged: ask first, because its edits are lost
  const [pendingLoad, setPendingLoad] = useState<{ number: string; mrq?: string } | null>(null);
  const requestLoad = (number: string, mrq?: string) => {
    if (details && !loading) setPendingLoad({ number, mrq });
    else loadDetails(number, mrq);
  };

  const loadDetails = async (number: string, mrq?: string) => {
    if (!number.trim()) { toast.error('Enter or select an MRL number.'); return; }
    setLoading(true);
    setResult(null);
    try {
      const d = await apiRequest<MrlDetails>('receiving:getMrlDetails', { mrlNumber: number.trim(), mrqNumber: mrq || '' });
      setDetails(d);
      setMrlNumber(d.mrl.mrlNumber);
      setMrqNumber(d.mrq.mrqNumber);
      setLines(d.lines.map(l => ({
        key: newLineKey(), lineNo: l.lineNo, itemId: l.itemId, itemName: l.itemName, mapped: l.mapped,
        requestedQty: l.requestedQty, releasedQty: l.releasedQty, receivedQty: String(l.releasedQty), uom: l.uom, catalogUom: l.catalogUom,
        ...priceFields({ ...l.price, options: l.priceOptions }), serialNumber: '', storageId: '',
        lineStatus: l.mapped ? 'VERIFIED' : 'REJECTED', mismatchDetails: l.mapped ? '' : 'Item not in the catalog / does not match the request'
      })));
      setParty(p => ({ ...p, activityId: d.suggestedActivity?.activityId || '' }));
    } catch (err: any) {
      setDetails(null);
      setLines([]);
      toast.error(err.message || 'Failed to load the MRL.');
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
    if (!details) { toast.error('Fetch the MRL first.'); return; }
    if (problem) { toast.error(problem); return; }
    submit();
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await apiRequest<SubmitResult>(
        'receiving:submit', buildPayload('MRL', mrlNumber, details, lines, party));
      setResult(res);
      notifySubmit(res, toast);
      resetForm();
      onSubmitted();
    } catch (err: any) {
      toast.error(err.message || 'Submitting the receipt failed.');
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
          {submitStatusText(result)}{' '}
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onViewPending}>View pending receipts</button>
        </div>
      )}

      <StepCard title="MRL" hint="Type the MRL number, or browse the released MRLs that are not received yet.">
        <div className="row g-2 align-items-end">
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">MRL number</label>
            <input className="form-control form-control-sm font-monospace" value={mrlNumber}
              onChange={e => { setMrlNumber(e.target.value); setMrqNumber(''); }}
              onKeyDown={e => { if (e.key === 'Enter') requestLoad(mrlNumber, mrqNumber); }} />
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => requestLoad(mrlNumber, mrqNumber)} disabled={loading}>
              {loading ? 'Loading' : 'Fetch'}
            </button>
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPickerOpen(true)}>Browse MRLs</button>
          </div>
        </div>
      </StepCard>

      {loading && (
        <div className="d-flex align-items-center gap-2 small text-secondary mb-4" role="status" aria-live="polite">
          <span className="spinner-border spinner-border-sm text-primary"></span> Loading the MRL…
        </div>
      )}

      {!loading && details && q && m && (
        <>
          <StepCard title="1. Delivery" hint="From the staged MRQ and MRL.">
            <div className="row g-3">
              {fact('MRL', <span className="font-monospace">{m.mrlNumber}</span>)}
              {fact('MRQ', <span className="font-monospace">{q.mrqNumber}</span>)}
              {fact('Integr8 GI', m.integr8GiNumber)}
              {fact('Released', [simpleDate(m.releasedAt), m.batchNumber].filter(Boolean).join(' · '))}
              {fact('Project', q.activityName)}
              {fact('Classification No.', <span className="font-monospace">{q.classificationId}</span>)}
              {fact('Location', [q.location, q.costCenter].filter(Boolean).join(' · '))}
              {fact('Requested by', [q.requestedBy, q.department].filter(Boolean).join(' · '))}
              {fact('Purpose', q.purpose)}
              {fact('Requested', [simpleDate(q.dateRequested), q.dateRequired && `needed ${simpleDate(q.dateRequired)}`].filter(Boolean).join(' · '))}
              {fact('Activity in system', details.suggestedActivity
                ? <span className="text-success">{details.suggestedActivity.activityId} — {details.suggestedActivity.activityName}</span>
                : <span className="text-warning-emphasis">none with this Classification No.</span>)}
            </div>
          </StepCard>

          <ReceivingLinesSection mode="MRL" title="2. Items" hint="Use the actions on each item: update the price or unit, or mark it as not matching (returned to ProcInv on an MRT)."
            lines={lines} onChange={setLines} spotOptions={spotOptions} allStorage={lookups.storage.storage}
            onAddToCatalog={mayAddToCatalog ? setCatalogLine : undefined} uoms={lookups.storage.uoms || []} />

          <ReceivingPartySection title="3. Receiving" party={party} onChange={setParty} storage={lookups.storage} activities={lookups.activities}
            details={details} suggested={details.suggestedActivity} onActivityCreated={lookups.reloadActivities} />
          <ConfirmationSection title="4. Confirmation" reference={`MRL ${mrlNumber}`} lines={lines} party={party} storage={lookups.storage} activities={lookups.activities}
            busy={submitting} onClear={resetForm} onSubmit={review} />
        </>
      )}

      <ConfirmModal
        isOpen={!!pendingLoad}
        title="Discard the MRL being staged?"
        message={details ? `MRL ${details.mrl.mrlNumber} is currently being staged. Loading another MRL will discard it and any changes you made to its items and receiving details.` : ''}
        confirmText="Discard and load"
        cancelText="Keep staging"
        isDanger
        onConfirm={() => { const next = pendingLoad; setPendingLoad(null); if (next) loadDetails(next.number, next.mrq); }}
        onCancel={() => setPendingLoad(null)}
      />
      <AddCatalogItemModal
        open={!!catalogLine}
        procurementName={catalogLine?.itemName || ''}
        defaultUom={catalogLine?.uom}
        onClose={() => setCatalogLine(null)}
        onAdded={added => {
          // every line with the same ProcInv description now points to the new catalog item (no price yet)
          const name = catalogLine?.itemName;
          setLines(prev => prev.map(l => (!l.mapped && l.itemName === name
            ? { ...l, itemId: added.itemId, itemName: added.name, mapped: true, uom: added.uom, catalogUom: added.uom, lineStatus: 'VERIFIED', mismatchDetails: '', ...priceFields({ unitCost: null, source: 'NONE' }) }
            : l)));
          setCatalogLine(null);
        }}
      />
      <MrlPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)}
        onSelect={(s: StagedMrlSummary) => { setPickerOpen(false); requestLoad(s.mrlNumber, s.mrqNumber); }} />
    </div>
  );
};
