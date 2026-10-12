import React, { useState } from 'react';
import { apiRequest } from '../../services/api';
import { StepCard } from './StepCard';
import { getCurrentUser } from '../../services/auth';
import { useAccountDirectory } from './useAccountDirectory';
import { activityLabel } from './receivingUtils';
import type { MrlDetails, OpenActivity, ReceivingParty, StorageOptions, SuggestedActivity } from '../../types';
import { Select } from '../Select';
import { Loading } from '../Loading';

interface Props {
  party: ReceivingParty;
  onChange: (p: ReceivingParty) => void;
  storage: StorageOptions;
  activities: OpenActivity[];
  /** MRQ/MRL details (MRL mode) used for the activity suggestion and prefill. */
  details: MrlDetails | null;
  suggested: SuggestedActivity | null;
  onActivityCreated: () => Promise<void>;
  title: string;
}

export const ReceivingPartySection: React.FC<Props> = ({ title, party, onChange, storage, activities, details, suggested, onActivityCreated }) => {
  const [showCreate, setShowCreate] = useState(false);
  const set = (patch: Partial<ReceivingParty>) => onChange({ ...party, ...patch });
  const areas = storage.storage.filter(s => s.storageType === 'AREA' && s.warehouseLocation === party.warehouseLocation);
  const area = areas.find(a => a.storageId === party.areaId);
  const directory = useAccountDirectory();
  const meEmail = (getCurrentUser()?.email || '').trim().toLowerCase();
  const isSelf = !!meEmail && party.receiverId.trim().toLowerCase() === meEmail;

  return (
    <StepCard title={title} hint="Where the items go, and who confirms they arrived.">
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label small fw-semibold mb-1">Destination</label>
          <div className="btn-group w-100" role="group">
            <button type="button" className={`btn btn-sm ${party.destinationType === 'WAREHOUSE' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => set({ destinationType: 'WAREHOUSE' })}>
              Warehouse
            </button>
            <button type="button" className={`btn btn-sm ${party.destinationType === 'ACTIVITY' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => set({ destinationType: 'ACTIVITY', activityId: party.activityId || suggested?.activityId || '' })}>
              Direct to activity
            </button>
          </div>
        </div>

        {party.destinationType === 'WAREHOUSE' ? (
          <>
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Warehouse</label>
              <Select className="form-select form-select-sm" value={party.warehouseLocation}
                onChange={e => set({ warehouseLocation: e.target.value, areaId: '' })}>
                {storage.warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.id})</option>)}
              </Select>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Area</label>
              <Select optional noneLabel={areas.length === 0 ? 'No areas in this warehouse' : 'None (whole warehouse)'} className="form-select form-select-sm" value={party.areaId} disabled={areas.length === 0}
                onChange={e => set({ areaId: e.target.value })}>
                {areas.map(a => <option key={a.storageId} value={a.storageId}>{a.name}{a.ownerSubDepartment ? ` — ${a.ownerSubDepartment}` : ''}</option>)}
              </Select>
              {area && <div className="form-text">Owner: {area.ownerSubDepartment || 'common area'}</div>}
            </div>
          </>
        ) : (
          <div className="col-12">
            <label className="form-label small fw-semibold mb-1">Activity</label>
            {suggested && party.activityId !== suggested.activityId && (
              <div className="small mb-2">
                Matches this MRQ: <strong>[{details?.mrq.classificationId}] {suggested.activityName}</strong>{' '}
                <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => set({ activityId: suggested.activityId })}>Use it</button>
              </div>
            )}
            {!suggested && details && (
              <div className="small mb-2 text-warning-emphasis">
                No activity has Classification No. <strong>{details.mrq.classificationId || '(none)'}</strong>.{' '}
                <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setShowCreate(true)}>Create one</button>
              </div>
            )}
            <div className="d-flex gap-2">
              <Select className="form-select form-select-sm" value={party.activityId} onChange={e => set({ activityId: e.target.value })}>
                {activities.map(a => (
                  <option key={a.Activity_ID} value={a.Activity_ID}>{activityLabel(a)}</option>
                ))}
              </Select>
              {!details && <button type="button" className="btn btn-outline-secondary btn-sm text-nowrap" onClick={() => setShowCreate(true)}>New activity</button>}
            </div>
            <div className="form-text">Billed at the received price. The warehouse balance is not touched.</div>
          </div>
        )}

        <div className="col-md-6">
          <label className="form-label small fw-semibold mb-1" htmlFor="receiving-party">Goods Issued to</label>
          <div className="d-flex align-items-center gap-3">
            <Select id="receiving-party" className="form-select form-select-sm" value={party.receiverId}
              onChange={e => set({ receiverId: e.target.value, autoReceive: e.target.value === meEmail ? party.autoReceive : false })}>
              {meEmail && <option value={meEmail}>{getCurrentUser()?.name || meEmail} (me)</option>}
              {directory.options.filter(p => p.email.toLowerCase() !== meEmail).map(p => (
                <option key={p.email} value={p.email}>{p.label}</option>
              ))}
            </Select>
            <div className="form-check mb-0 text-nowrap" title={isSelf ? 'Post the items to the inventory as soon as you submit' : 'Choose your own account to receive the items straight away'}>
              <input id="auto-receive" type="checkbox" className="form-check-input" checked={party.autoReceive} disabled={!isSelf}
                onChange={e => set({ autoReceive: e.target.checked })} />
              <label htmlFor="auto-receive" className="form-check-label small">Auto-receive</label>
            </div>
          </div>
          <div className="form-text">
            {party.autoReceive
              ? 'The items are received into the inventory as soon as you submit.'
              : 'This person confirms receipt with their own login. Nothing is posted until they do.' + (directory.sample ? ' Sample accounts until the account import has data.' : '')}
          </div>
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold mb-1">Remarks</label>
          <textarea className="form-control form-control-sm" rows={2}
            value={party.remarks} onChange={e => set({ remarks: e.target.value })}></textarea>
        </div>
      </div>

      {showCreate && (
        <CreateActivityModal
          details={details}
          subDepartments={storage.subDepartments || []}
          onClose={() => setShowCreate(false)}
          onCreated={async (id) => { await onActivityCreated(); set({ activityId: id }); setShowCreate(false); }}
        />
      )}
    </StepCard>
  );
};

interface CreateProps {
  details: MrlDetails | null;
  subDepartments: string[];
  onClose: () => void;
  onCreated: (activityId: string) => Promise<void>;
}

const CreateActivityModal: React.FC<CreateProps> = ({ details, subDepartments, onClose, onCreated }) => {
  const mine = (getCurrentUser()?.subdepartments || [])[0] || '';
  const [subDepartment, setSubDepartment] = useState(mine);
  const options = mine && !subDepartments.some(s => s.toLowerCase() === mine.toLowerCase()) ? [mine, ...subDepartments] : subDepartments;
  const [name, setName] = useState(details?.mrq.activityName || '');
  const [classRef, setClassRef] = useState(details?.mrq.classificationId || '');
  const [site, setSite] = useState([details?.mrq.location, details?.mrq.costCenter].filter(Boolean).join(' — '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<{ activityId: string }>('activity:create', { activityName: name, procInvClassRef: classRef, siteLocation: site, subDepartment });
      await onCreated(res.activityId);
    } catch (err: any) {
      setError(err.message || 'Failed to create the activity.');
      setBusy(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <h6 className="modal-title fw-bold mb-0">Create Activity</h6>
            <button type="button" className="btn-close" onClick={onClose} disabled={busy}></button>
          </div>
          <div className="modal-body p-4">
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <div className="mb-3">
              <label className="form-label small fw-semibold mb-1">Activity name *</label>
              <input className="form-control form-control-sm" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold mb-1">ProcInv Classification No. *</label>
              <input className="form-control form-control-sm font-monospace" value={classRef} onChange={e => setClassRef(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold mb-1">Site location</label>
              <input className="form-control form-control-sm" value={site} onChange={e => setSite(e.target.value)} />
            </div>
            <div className="mb-1">
              <label className="form-label small fw-semibold mb-1">Sub-department</label>
              <Select optional noneLabel="None (not assigned)" className="form-select form-select-sm" value={subDepartment} onChange={e => setSubDepartment(e.target.value)}>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </Select>
              <div className="form-text">Defaults to yours. The list is the Sub_Departments column on the CONFIG tab.</div>
            </div>
            <div className="form-text">Created as PLANNED.</div>
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !name.trim() || !classRef.trim()}>
              {busy ? <Loading variant="button" label="Creating…" /> : 'Create activity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
