/**
 * @file Assignments.tsx
 * @description The MRL assignment screens: the Head's queue (confirm a release and assign it), the task list for the assignee
 * and the delegate (verify, delegate to an FMS, take back, reassign, close a balance), the verification and delegation dialogs,
 * and the destination fields they share.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr, invalidateCache } from '../../services/cache';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { useToast } from '../../context/ToastContext';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';
import { Select } from '../Select';
import { Loading } from '../Loading';
import type { DirectoryAccount, MrlListResponse, MrlTask, OpenActivity, StagedMrlSummary, StorageOptions, TaskLine } from '../../types';

const OPEN = ['PLANNED', 'ACTIVE', 'ON_HOLD'];
const TYPES: [string, string][] = [['ITEM', 'Wrong item'], ['SPECIFICATION', 'Wrong specification'], ['BRAND', 'Wrong brand'], ['DAMAGED', 'Damaged or defective'], ['QTY_SHORT', 'Short'], ['QTY_OVER', 'More than released']];
const n = (v: unknown) => Number(v) || 0;
const STATUS_LABEL: Record<string, string> = { ASSIGNED: 'Assigned', DELEGATED: 'Delegated', CONFIRMED: 'Verified', CANCELLED: 'Cancelled' };

function useDirectory() {
  const [accounts, setAccounts] = useState<DirectoryAccount[]>([]);
  useEffect(() => {
    let alive = true;
    fetchWithSwr<DirectoryAccount[]>('accounts:directory', () => apiRequest<DirectoryAccount[]>('accounts:getDirectory'), d => { if (alive && Array.isArray(d)) setAccounts(d); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return accounts;
}

const has = (list: string[], v: string) => list.some(x => x.trim().toLowerCase() === v.toLowerCase());

const Modal: React.FC<{ title: string; busy?: boolean; onClose: () => void; wide?: boolean; children: React.ReactNode; footer: React.ReactNode }> = ({ title, busy, onClose, wide, children, footer }) => (
  <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className={`modal-dialog${wide ? ' modal-xl' : ''}`}>
      <div className="modal-content">
        <div className="modal-header"><h6 className="modal-title fw-bold">{title}</h6><button type="button" className="btn-close" disabled={busy} onClick={onClose}></button></div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  </div>
);

interface Dest { destinationType: 'WAREHOUSE' | 'ACTIVITY' | ''; warehouseLocation: string; areaId: string; activityId: string }
const EMPTY_DEST: Dest = { destinationType: '', warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN', areaId: '', activityId: '' };

/** Where the goods go: a warehouse (and area), or straight to an open activity. */
const DestinationFields: React.FC<{ value: Dest; onChange: (d: Dest) => void }> = ({ value, onChange }) => {
  const [storage, setStorage] = useState<StorageOptions>({ warehouses: [], storage: [] });
  const [activities, setActivities] = useState<OpenActivity[]>([]);
  useEffect(() => {
    apiRequest<StorageOptions>('receiving:getStorageOptions').then(setStorage).catch(() => undefined);
    apiRequest<OpenActivity[]>('activity:getAll', { status: 'ALL' }).then(r => setActivities((Array.isArray(r) ? r : []).filter(a => OPEN.includes(String(a.Status).toUpperCase())))).catch(() => undefined);
  }, []);
  const areas = storage.storage.filter(s => s.storageType === 'AREA' && s.warehouseLocation === value.warehouseLocation);
  return (
    <div className="row g-2">
      <div className="col-12">
        <div className="btn-group btn-group-sm" role="radiogroup" aria-label="Destination">
          <button type="button" role="radio" aria-checked={value.destinationType === 'WAREHOUSE'} className={`btn ${value.destinationType === 'WAREHOUSE' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => onChange({ ...value, destinationType: 'WAREHOUSE' })}>Store in the warehouse</button>
          <button type="button" role="radio" aria-checked={value.destinationType === 'ACTIVITY'} className={`btn ${value.destinationType === 'ACTIVITY' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => onChange({ ...value, destinationType: 'ACTIVITY' })}>Direct to an activity</button>
        </div>
      </div>
      {value.destinationType === 'WAREHOUSE' && (
        <>
          <div className="col-md-6">
            <label className="form-label small fw-semibold mb-1">Warehouse</label>
            <Select className="form-select form-select-sm" value={value.warehouseLocation} onChange={e => onChange({ ...value, warehouseLocation: e.target.value, areaId: '' })}>
              {storage.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              {storage.warehouses.length === 0 && <option value="FACILITIES_WAREHOUSE_MAIN">FACILITIES_WAREHOUSE_MAIN</option>}
            </Select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold mb-1">Area</label>
            <Select optional noneLabel="No area" className="form-select form-select-sm" value={value.areaId} onChange={e => onChange({ ...value, areaId: e.target.value })}>
              {areas.map(a => <option key={a.storageId} value={a.storageId}>{a.name || a.storageId}</option>)}
            </Select>
          </div>
        </>
      )}
      {value.destinationType === 'ACTIVITY' && (
        <div className="col-12">
          <label className="form-label small fw-semibold mb-1">Activity</label>
          <Select className="form-select form-select-sm" value={value.activityId} onChange={e => onChange({ ...value, activityId: e.target.value })}>
            {activities.map(a => <option key={a.Activity_ID} value={a.Activity_ID}>{a.Activity_ID} · {a.Activity_Name}</option>)}
          </Select>
        </div>
      )}
    </div>
  );
};

const destReady = (d: Dest) => d.destinationType === 'WAREHOUSE' || (d.destinationType === 'ACTIVITY' && !!d.activityId);

// ---------------------------------------------------------------------------
// Head: MRLs waiting to be confirmed and assigned
// ---------------------------------------------------------------------------
export const AssignQueue: React.FC<{ onAssigned: () => void }> = ({ onAssigned }) => {
  const toast = useToast();
  const accounts = useDirectory();
  const [data, setData] = useState<MrlListResponse | null>(null);
  const [subs, setSubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pick, setPick] = useState<StagedMrlSummary | null>(null);
  const [sub, setSub] = useState('');
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([apiRequest<MrlListResponse>('receiving:listMrls'), apiRequest<StorageOptions>('receiving:getStorageOptions')])
      .then(([m, o]) => { setData(m); setSubs(o.subDepartments || []); })
      .catch(e => toast.error(e.message || 'Could not load the MRLs.')).finally(() => setLoading(false));
  }, [toast]);
  useEffect(load, [load]);

  const people = useMemo(() => accounts.filter(a => has(a.roles, 'Sub-Department') && has(a.departments, 'Facilities') && (!sub || has(a.subdepartments, sub))), [accounts, sub]);
  const rows = (data?.mrls || []).filter(m => !search.trim() || `${m.mrlNumber} ${m.mrqNumber} ${m.projectName}`.toLowerCase().includes(search.trim().toLowerCase()));
  const columns: Column<StagedMrlSummary>[] = [
    { key: 'mrlNumber', label: 'MRL', sortable: true, minWidth: '90px' },
    { key: 'mrqNumber', label: 'MRQ', sortable: true, minWidth: '90px' },
    { key: 'projectName', label: 'Project', minWidth: '200px', render: r => r.projectName || 'No Data' },
    { key: 'batchNumber', label: 'Batch', minWidth: '80px', render: r => r.batchNumber || 'No Data' },
    { key: 'lineCount', label: 'Lines', align: 'right', minWidth: '60px' },
    { key: 'openQty', label: 'To receive', align: 'right', minWidth: '90px', render: r => String(r.openQty ?? r.totalQuantity) },
    { key: 'suggestedSubDepartment', label: 'Suggested sub-department', minWidth: '170px', render: r => r.suggestedSubDepartment || 'TBD' },
    { key: 'actions', label: '', align: 'right', minWidth: '110px', render: r => <button type="button" className="btn btn-primary btn-sm" onClick={() => { setPick(r); setSub(r.suggestedSubDepartment || ''); setAssignee(''); }}>Confirm &amp; assign</button> }
  ];

  const submit = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await apiRequest('receiving:confirmRelease', { mrlNumber: pick.mrlNumber, mrqNumber: pick.mrqNumber, subDepartment: sub, assigneeId: assignee });
      toast.success(`MRL ${pick.mrlNumber} was assigned to ${assignee}.`);
      setPick(null); invalidateCache('receiving:'); load(); onAssigned();
    } catch (e: any) { toast.error(e.message || 'Could not assign the MRL.'); } finally { setBusy(false); }
  };

  return (
    <>
      <DataCard<StagedMrlSummary> title="MRLs to assign" description="Confirm the release of an MRL and assign it to a Sub-Department user to verify."
        columns={columns} data={rows} keyField="mrlNumber" isLoading={loading && !data} searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search by MRL, MRQ, project..."
        onRefresh={load} refreshing={loading} emptyMessage="No MRL is waiting to be assigned." />
      {pick && (
        <Modal title={`Confirm release and assign MRL ${pick.mrlNumber}`} busy={busy} onClose={() => setPick(null)}
          footer={<>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => setPick(null)}>Cancel</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy || !sub || !assignee} onClick={submit}>{busy ? <Loading variant="button" label="Assigning..." /> : 'Confirm & assign'}</button>
          </>}>
          <div className="small text-muted mb-3">{pick.projectName} · MRQ {pick.mrqNumber} · {pick.lineCount} line(s), {pick.openQty ?? pick.totalQuantity} to receive</div>
          <div className="mb-3">
            <label className="form-label small fw-semibold">Sub-Department *</label>
            <Select className="form-select form-select-sm" value={sub} onChange={e => { setSub(e.target.value); setAssignee(''); }}>
              {subs.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="mb-1">
            <label className="form-label small fw-semibold">Assign to *</label>
            <Select className="form-select form-select-sm" value={assignee} onChange={e => setAssignee(e.target.value)}>
              {people.map(a => <option key={a.email} value={a.email}>{a.name || a.email} ({a.email})</option>)}
            </Select>
            {sub && people.length === 0 && <div className="form-text text-warning-emphasis">No Sub-Department account is listed for {sub}.</div>}
          </div>
        </Modal>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Verification dialog
// ---------------------------------------------------------------------------
interface LineForm { recv: string; ret: string; type: string; details: string; delivered: string; shortRes: 'OPEN' | 'CLOSED' }

const VerifyModal: React.FC<{ task: MrlTask; onClose: () => void; onDone: () => void }> = ({ task, onClose, onDone }) => {
  const toast = useToast();
  const lines = task.items.filter(l => l.Line_Status === 'AWAITING');
  const [form, setForm] = useState<Record<string, LineForm>>(() => Object.fromEntries(lines.map(l => [l.Receipt_Line_ID, { recv: String(l.Released_Qty), ret: '', type: '', details: '', delivered: '', shortRes: 'OPEN' as const }])));
  const [dest, setDest] = useState<Dest>(EMPTY_DEST);
  const [busy, setBusy] = useState(false);
  const preset = task.Status === 'DELEGATED';
  const set = (id: string, patch: Partial<LineForm>) => setForm(f => ({ ...f, [id]: { ...f[id], ...patch } }));
  const short = (l: TaskLine) => { const f = form[l.Receipt_Line_ID]; return Math.max(0, n(l.Released_Qty) - n(f.recv) - n(f.ret)); };
  const over = (l: TaskLine) => { const f = form[l.Receipt_Line_ID]; return n(f.recv) + n(f.ret) > n(l.Released_Qty); };
  const needsReason = lines.some(l => short(l) > 0 && form[l.Receipt_Line_ID].shortRes === 'CLOSED' && !form[l.Receipt_Line_ID].details.trim());
  const ready = (preset || destReady(dest)) && !needsReason;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await apiRequest<{ followUpReceiptId: string | null; short: number; over: number; returned: number }>('receiving:verify', {
        receiptId: task.Receipt_ID,
        ...(preset ? {} : { destinationType: dest.destinationType, warehouseLocation: dest.warehouseLocation, areaId: dest.areaId, activityId: dest.activityId }),
        lines: lines.map(l => { const f = form[l.Receipt_Line_ID]; return { receiptLineId: l.Receipt_Line_ID, receivedQty: n(f.recv), returnedQty: n(f.ret), mismatchType: f.type, mismatchDetails: f.details, deliveredItemName: f.delivered, shortResolution: f.shortRes }; })
      });
      toast.success(`MRL ${task.Source_Reference} verified.${res.followUpReceiptId ? ' A follow-up task holds the balance.' : ''}${res.over ? ' Extra items were flagged.' : ''}`);
      onDone();
    } catch (e: any) { toast.error(e.message || 'Verification failed.'); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={`Verify MRL ${task.Source_Reference}`} busy={busy} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !ready} onClick={submit}>{busy ? <Loading variant="button" label="Posting..." /> : 'Verify and receive'}</button>
      </>}>
      <div className="small text-muted mb-2">{task.Project_Name} · MRQ {task.MRQ_Number}{task.Sub_Department ? ` · ${task.Sub_Department}` : ''}</div>
      <div className="table-responsive mb-3">
        <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
          <thead><tr><th>Item</th><th className="text-end">Released</th><th style={{ width: 90 }}>Received</th><th style={{ width: 90 }}>Return</th><th>Mismatch</th><th>Details / delivered item</th><th>Shortage</th></tr></thead>
          <tbody>
            {lines.map(l => {
              const f = form[l.Receipt_Line_ID];
              const s = short(l);
              return (
                <tr key={l.Receipt_Line_ID}>
                  <td>{l.Item_Name}<div className="text-muted small">{l.UOM}</div></td>
                  <td className="text-end">{l.Released_Qty}</td>
                  <td><input type="number" min="0" step="any" className="form-control form-control-sm" aria-label="Received" value={f.recv} onChange={e => set(l.Receipt_Line_ID, { recv: e.target.value })} /></td>
                  <td><input type="number" min="0" step="any" className="form-control form-control-sm" aria-label="Return" value={f.ret} onChange={e => set(l.Receipt_Line_ID, { ret: e.target.value })} /></td>
                  <td><Select optional noneLabel="None" className="form-select form-select-sm" value={f.type} onChange={e => set(l.Receipt_Line_ID, { type: e.target.value })}>{TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Select></td>
                  <td>
                    <input type="text" className="form-control form-control-sm mb-1" placeholder="What is different" value={f.details} onChange={e => set(l.Receipt_Line_ID, { details: e.target.value })} />
                    {n(f.ret) > 0 && <input type="text" className="form-control form-control-sm" placeholder="Item that actually arrived" value={f.delivered} onChange={e => set(l.Receipt_Line_ID, { delivered: e.target.value })} />}
                  </td>
                  <td>
                    {s > 0 ? (
                      <>
                        <div className="text-warning-emphasis">{s} short</div>
                        <Select className="form-select form-select-sm" value={f.shortRes} onChange={e => set(l.Receipt_Line_ID, { shortRes: e.target.value as 'OPEN' | 'CLOSED' })}>
                          <option value="OPEN">Expect the balance</option>
                          <option value="CLOSED">No more is coming</option>
                        </Select>
                      </>
                    ) : over(l) ? <span className="text-warning-emphasis">More than released: flagged</span> : <span className="text-muted">Complete</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {needsReason && <div className="alert alert-warning py-2 small">Say why the shortage is closed in the line's details.</div>}
      <div className="fw-semibold small mb-1">Destination</div>
      {preset
        ? <div className="small">{task.Destination_Type === 'ACTIVITY' ? `Direct to activity ${task.Activity_ID}` : `Warehouse ${task.Warehouse_Location}${task.Area_ID ? ` · ${task.Area_ID}` : ''}`} <span className="text-muted">(set when it was delegated to you)</span></div>
        : <DestinationFields value={dest} onChange={setDest} />}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Delegate / reassign dialogs
// ---------------------------------------------------------------------------
const DelegateModal: React.FC<{ task: MrlTask; onClose: () => void; onDone: () => void }> = ({ task, onClose, onDone }) => {
  const toast = useToast();
  const accounts = useDirectory();
  const [fms, setFms] = useState('');
  const [dest, setDest] = useState<Dest>(EMPTY_DEST);
  const [busy, setBusy] = useState(false);
  const people = accounts.filter(a => has(a.roles, 'FMS') && has(a.departments, 'Facilities') && has(a.subdepartments, task.Sub_Department));
  const submit = async () => {
    setBusy(true);
    try {
      await apiRequest('receiving:delegate', { receiptId: task.Receipt_ID, fmsId: fms, destinationType: dest.destinationType, warehouseLocation: dest.warehouseLocation, areaId: dest.areaId, activityId: dest.activityId });
      toast.success(`MRL ${task.Source_Reference} was delegated to ${fms}.`);
      onDone();
    } catch (e: any) { toast.error(e.message || 'Could not delegate.'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Delegate MRL ${task.Source_Reference} to an FMS`} busy={busy} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !fms || !destReady(dest)} onClick={submit}>{busy ? <Loading variant="button" label="Delegating..." /> : 'Delegate'}</button>
      </>}>
      <div className="mb-3">
        <label className="form-label small fw-semibold">FMS of {task.Sub_Department || 'the sub-department'} *</label>
        <Select className="form-select form-select-sm" value={fms} onChange={e => setFms(e.target.value)}>
          {people.map(a => <option key={a.email} value={a.email}>{a.name || a.email} ({a.email})</option>)}
        </Select>
        {people.length === 0 && <div className="form-text text-warning-emphasis">No FMS account is listed for this sub-department.</div>}
      </div>
      <div className="fw-semibold small mb-1">Destination (required) *</div>
      <DestinationFields value={dest} onChange={setDest} />
    </Modal>
  );
};

const ReassignModal: React.FC<{ task: MrlTask; onClose: () => void; onDone: () => void }> = ({ task, onClose, onDone }) => {
  const toast = useToast();
  const accounts = useDirectory();
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const people = accounts.filter(a => has(a.roles, 'Sub-Department') && has(a.departments, 'Facilities') && has(a.subdepartments, task.Sub_Department));
  const submit = async () => {
    setBusy(true);
    try { await apiRequest('receiving:reassign', { receiptId: task.Receipt_ID, assigneeId: who }); toast.success('Task reassigned.'); onDone(); }
    catch (e: any) { toast.error(e.message || 'Could not reassign.'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Reassign MRL ${task.Source_Reference}`} busy={busy} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !who} onClick={submit}>{busy ? <Loading variant="button" label="Saving..." /> : 'Reassign'}</button>
      </>}>
      <label className="form-label small fw-semibold">Assign to *</label>
      <Select className="form-select form-select-sm" value={who} onChange={e => setWho(e.target.value)}>
        {people.map(a => <option key={a.email} value={a.email}>{a.name || a.email} ({a.email})</option>)}
      </Select>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const Assignments: React.FC<{ refreshKey: number; onChanged: () => void; onCount?: (n: number) => void }> = ({ refreshKey, onChanged, onCount }) => {
  const toast = useToast();
  const access = getAccess(getCurrentUser());
  const [tasks, setTasks] = useState<MrlTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'open' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [verifying, setVerifying] = useState<MrlTask | null>(null);
  const [delegating, setDelegating] = useState<MrlTask | null>(null);
  const [reassigning, setReassigning] = useState<MrlTask | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiRequest<MrlTask[]>('receiving:getAssigned', { status: view === 'all' ? 'ALL' : '' })
      .then(r => { setTasks(Array.isArray(r) ? r : []); })
      .catch(e => toast.error(e.message || 'Could not load the tasks.')).finally(() => setLoading(false));
  }, [view, toast]);
  useEffect(load, [load, refreshKey]);
  useEffect(() => { onCount?.(tasks.filter(t => t.canVerify).length); }, [tasks, onCount]);

  const done = () => { setVerifying(null); setDelegating(null); setReassigning(null); invalidateCache('receiving:'); invalidateCache('inventory:stock'); load(); onChanged(); };
  const act = async (action: string, payload: object, msg: string) => {
    try { await apiRequest(action, payload); toast.success(msg); done(); } catch (e: any) { toast.error(e.message || 'Action failed.'); }
  };
  const rows = tasks.filter(t => !search.trim() || `${t.Source_Reference} ${t.MRQ_Number} ${t.Project_Name} ${t.Receiver_ID}`.toLowerCase().includes(search.trim().toLowerCase()));

  const columns: Column<MrlTask>[] = [
    { key: 'Source_Reference', label: 'MRL', sortable: true, minWidth: '90px', render: t => <>{t.Source_Reference}{t.Parent_Receipt_ID && <span className="badge text-bg-light border fw-normal ms-1">balance</span>}</> },
    { key: 'Project_Name', label: 'Project', minWidth: '180px', render: t => t.Project_Name || 'No Data' },
    { key: 'Sub_Department', label: 'Sub-Department', minWidth: '130px', render: t => t.Sub_Department || 'No Data' },
    { key: 'Receiver_ID', label: 'With', minWidth: '170px', render: t => t.Status === 'CONFIRMED' || t.Status === 'CANCELLED' ? 'No Data' : t.Receiver_ID },
    { key: 'Status', label: 'Status', align: 'center', minWidth: '100px', render: t => STATUS_LABEL[t.Status] || t.Status },
    { key: 'items', label: 'Lines', align: 'right', minWidth: '60px', render: t => String(t.items.length) },
    {
      key: 'actions', label: '', align: 'right', minWidth: '320px', render: t => (
        <div className="d-flex justify-content-end flex-wrap gap-1">
          {t.canVerify && <button type="button" className="btn btn-primary btn-sm" onClick={() => setVerifying(t)}>Verify</button>}
          {t.canDelegate && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDelegating(t)}>Delegate to FMS</button>}
          {t.canTakeBack && <button type="button" className="btn btn-secondary btn-sm" onClick={() => act('receiving:reassign', { receiptId: t.Receipt_ID, takeBack: true }, 'Task taken back.')}>Take back</button>}
          {t.canVerify && t.Parent_Receipt_ID && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { const r = window.prompt('Why is the balance closed? (no more is coming)'); if (r) act('receiving:closeBalance', { receiptId: t.Receipt_ID, reason: r }, 'Balance closed.'); }}>Close balance</button>}
          {access.isAdmin && (t.Status === 'ASSIGNED' || t.Status === 'DELEGATED') && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setReassigning(t)}>Reassign</button>}
          {access.isAdmin && (t.Status === 'ASSIGNED' || t.Status === 'DELEGATED') && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => { const r = window.prompt('Why is this assignment cancelled?'); if (r) act('receiving:cancel', { receiptId: t.Receipt_ID, reason: r }, 'Assignment cancelled.'); }}>Cancel</button>}
        </div>
      )
    }
  ];

  return (
    <>
      <DataCard<MrlTask> title="Assignments" description={access.fieldOnly ? 'Deliveries delegated to you to verify.' : 'MRLs assigned to you, or delegated by you, to verify.'}
        tabs={[{ key: 'open', label: 'Open' }, { key: 'all', label: 'All' }]} activeTab={view} onTabChange={k => setView(k as 'open' | 'all')}
        columns={columns} data={rows} keyField="Receipt_ID" isLoading={loading && tasks.length === 0} searchQuery={search} onSearchChange={setSearch}
        searchPlaceholder="Search by MRL, MRQ, project, person..." onRefresh={load} refreshing={loading} emptyMessage="Nothing is assigned to you." />
      {verifying && <VerifyModal task={verifying} onClose={() => setVerifying(null)} onDone={done} />}
      {delegating && <DelegateModal task={delegating} onClose={() => setDelegating(null)} onDone={done} />}
      {reassigning && <ReassignModal task={reassigning} onClose={() => setReassigning(null)} onDone={done} />}
    </>
  );
};
