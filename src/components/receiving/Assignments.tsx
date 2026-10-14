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
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { SlowHint } from '../SlowHint';
import { verifySummary, delegateSummary } from './resultSummary';
import { DataCard } from '../DataCard';
import { ActionMenu } from '../ActionMenu';
import type { Column } from '../DataTable';
import { sameProject, mismatchText } from './projectGuard';
import { Select } from '../Select';
import { PersonSelect } from '../form/PersonSelect';
import { spotPath, spotsInArea } from './receivingUtils';
import { Loading } from '../Loading';
import type { DirectoryAccount, MrlListResponse, MrlTask, OpenActivity, StagedMrlSummary, StorageOptions, TaskLine } from '../../types';

const OPEN = ['PLANNED', 'ACTIVE', 'ON_HOLD'];
const TYPES: [string, string][] = [['ITEM', 'Wrong item'], ['SPECIFICATION', 'Wrong specification'], ['BRAND', 'Wrong brand'], ['DAMAGED', 'Damaged or defective'], ['QTY_SHORT', 'Short'], ['QTY_OVER', 'More than released']];
const n = (v: unknown) => Number(v) || 0;
const fmtMoney = (v: number) => `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

/** Names for the warehouse and area codes of the storage options (cached), so result dialogs say "Main Warehouse", not "WHSE01". */
function useStorageNames() {
  const [opts, setOpts] = useState<StorageOptions | null>(null);
  useEffect(() => {
    fetchWithSwr<StorageOptions>('receiving:storageOptions', () => apiRequest<StorageOptions>('receiving:getStorageOptions'), o => { if (o) setOpts(o); }, { persist: true }).catch(() => undefined);
  }, []);
  return {
    warehouse: (id: string) => opts?.warehouses.find(w => w.id === id)?.name || id,
    area: (id: string) => opts?.storage.find(x => x.storageId === id)?.name || id,
    /** the shelves, levels, containers and spaces inside an area, with their path as the label */
    spots: (areaId: string) => (opts && areaId ? spotsInArea(opts.storage, areaId).map(n => ({ id: n.storageId, label: spotPath(opts.storage, n.storageId) || n.storageId })) : [])
  };
}

const has = (list: string[], v: string) => list.some(x => x.trim().toLowerCase() === v.toLowerCase());

const Modal: React.FC<{ title: string; busy?: boolean; onClose: () => void; wide?: boolean; error?: string; children: React.ReactNode; footer: React.ReactNode }> = ({ title, busy, onClose, wide, error, children, footer }) => (
  <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className={`modal-dialog${wide ? ' modal-xl' : ''}`}>
      <div className="modal-content">
        <div className="modal-header"><h6 className="modal-title fw-bold">{title}</h6><button type="button" className="btn-close" disabled={busy} onClick={onClose}></button></div>
        <div className="modal-body">
          {error && <div className="alert alert-danger small py-2" role="alert"><i className="bi bi-exclamation-octagon-fill me-2"></i>{error}</div>}
          {children}
        </div>
        <div className="modal-footer"><SlowHint busy={!!busy} />{footer}</div>
      </div>
    </div>
  </div>
);

interface Dest { destinationType: 'WAREHOUSE' | 'ACTIVITY' | ''; warehouseLocation: string; areaId: string; activityId: string }
const EMPTY_DEST: Dest = { destinationType: '', warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN', areaId: '', activityId: '' };

/** Where the goods go: a warehouse (and area), or straight to an open activity. */
const DestinationFields: React.FC<{ value: Dest; onChange: (d: Dest) => void; classification?: string; approvedActivity?: MrlTask['approvedActivity']; onBlockedChange?: (blocked: boolean) => void }> = ({ value, onChange, classification, approvedActivity, onBlockedChange }) => {
  const approvedActivityId = approvedActivity?.id;
  const [storage, setStorage] = useState<StorageOptions>({ warehouses: [], storage: [] });
  const [visibleActivities, setActivities] = useState<OpenActivity[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  // the activities the person can see, plus the one a Head approved for this task (it may belong to another sub-department)
  const activities = useMemo(() => (approvedActivity && OPEN.includes(String(approvedActivity.status).toUpperCase()) && !visibleActivities.some(a => a.Activity_ID === approvedActivity.id)
    ? [...visibleActivities, { Activity_ID: approvedActivity.id, Activity_Name: approvedActivity.name, Status: approvedActivity.status, ProcInv_Class_Ref: approvedActivity.classificationRef, Sub_Department: approvedActivity.subDepartment } as OpenActivity]
    : visibleActivities), [visibleActivities, approvedActivity]);
  useEffect(() => {
    apiRequest<StorageOptions>('receiving:getStorageOptions').then(setStorage).catch(() => undefined);
    apiRequest<OpenActivity[]>('activity:getAll', { status: 'ALL' }).then(r => setActivities((Array.isArray(r) ? r : []).filter(a => OPEN.includes(String(a.Status).toUpperCase())))).catch(() => undefined).finally(() => setActivitiesLoaded(true));
  }, []);
  // the form starts with a placeholder warehouse code: once the real warehouses are known, use the first one (what the dropdown shows)
  useEffect(() => {
    if (storage.warehouses.length > 0 && !storage.warehouses.some(w => w.id === value.warehouseLocation)) onChange({ ...value, warehouseLocation: storage.warehouses[0].id, areaId: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage.warehouses, value.warehouseLocation]);
  const areas = storage.storage.filter(s => s.storageType === 'AREA' && s.warehouseLocation === value.warehouseLocation);
  // an activity of another project is blocked unless a Head approved exactly that activity when assigning
  const chosen = value.destinationType === 'ACTIVITY' ? activities.find(a => a.Activity_ID === value.activityId) : undefined;
  const otherProject = !!chosen && !sameProject(chosen.ProcInv_Class_Ref, classification);
  const approved = otherProject && approvedActivityId === chosen!.Activity_ID;
  const blocked = otherProject && !approved;
  useEffect(() => { onBlockedChange?.(blocked); }, [blocked, onBlockedChange]);
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
            {[...activities].sort((a, b) => Number(!sameProject(a.ProcInv_Class_Ref, classification)) - Number(!sameProject(b.ProcInv_Class_Ref, classification))).map(a => (
              <option key={a.Activity_ID} value={a.Activity_ID}>{a.Activity_ID} · {a.Activity_Name}{approvedActivityId === a.Activity_ID && approvedActivity?.subDepartment ? ` (${approvedActivity.subDepartment}, approved)` : ''}{!sameProject(a.ProcInv_Class_Ref, classification) && approvedActivityId !== a.Activity_ID ? ' (other project)' : ''}</option>
            ))}
          </Select>
          {activitiesLoaded && activities.length === 0 && (
            <div className="alert alert-warning small py-2 mt-2 mb-0">No open activity of your sub-department{classification ? ` matches this MRL (${classification})` : ' is available'}. Ask the Head to approve one when assigning the MRL, or store the delivery in the warehouse.</div>
          )}
          {blocked && <div className="alert alert-danger small py-2 mt-2 mb-0">{mismatchText(classification || '', chosen!.ProcInv_Class_Ref || '')} Choose the matching activity, or ask a Head to approve this one when assigning the MRL.</div>}
          {approved && <div className="form-text text-success-emphasis">A Head approved this activity for this MRL.{approvedActivity?.subDepartment ? ` It belongs to ${approvedActivity.subDepartment}: you post the delivery to it, and ${approvedActivity.subDepartment} uses it from there.` : ''}</div>}
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
  const navigate = useNavigate();
  const accounts = useDirectory();
  const [data, setData] = useState<MrlListResponse | null>(null);
  const [subs, setSubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pick, setPick] = useState<StagedMrlSummary | null>(null);
  const [sub, setSub] = useState('');
  const [assignee, setAssignee] = useState('');
  const [error, setError] = useState('');
  const [approveId, setApproveId] = useState('');
  const [approveWhy, setApproveWhy] = useState('');
  const [activities, setActivities] = useState<OpenActivity[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest<OpenActivity[]>('activity:getAll', { status: 'ALL' }).then(r => setActivities((Array.isArray(r) ? r : []).filter(a => OPEN.includes(String(a.Status).toUpperCase())))).catch(() => undefined);
  }, []);
  const otherProjects = activities.filter(a => pick && !sameProject(a.ProcInv_Class_Ref, pick.classificationId));

  const load = useCallback(() => {
    setLoading(true);
    // last-known list first (this call takes tens of seconds on a large sheet), then the fresh one
    fetchWithSwr<MrlListResponse>('receiving:assignQueue', () => apiRequest<MrlListResponse>('receiving:listMrls'), d => { if (d) { setData(d); setLoading(false); } }, { persist: true })
      .catch(e => toast.error(e.message || 'Could not load the MRLs.')).finally(() => setLoading(false));
    fetchWithSwr<StorageOptions>('receiving:storageOptions', () => apiRequest<StorageOptions>('receiving:getStorageOptions'), o => { if (o) setSubs(o.subDepartments || []); }, { persist: true }).catch(() => undefined);
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
    { key: 'actions', label: '', align: 'right', minWidth: '110px', render: r => <button type="button" className="btn btn-primary btn-sm" onClick={() => { setPick(r); setSub(r.suggestedSubDepartment || ''); setAssignee(''); setApproveId(''); setApproveWhy(''); setError(''); }}>Confirm &amp; assign</button> }
  ];

  const submit = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await apiRequest('receiving:confirmRelease', { mrlNumber: pick.mrlNumber, mrqNumber: pick.mrqNumber, subDepartment: sub, assigneeId: assignee,
        ...(approveId ? { approveActivityId: approveId, mismatchReason: approveWhy.trim() } : {}) });
      const mrl = pick.mrlNumber;
      const who = people.find(a => a.email === assignee)?.name || assignee;
      // stay in the queue: take the row off the list at once (the full reload takes a while and runs quietly after), and say it in a toast
      setData(d => (d ? { ...d, mrls: d.mrls.filter(m => m.mrlNumber !== mrl) } : d));
      setPick(null); invalidateCache('receiving:'); load(); onAssigned();
      toast.success(`MRL ${mrl} assigned to ${who} (${sub}). They were notified.`, { actions: [{ label: 'Open My tasks', onClick: () => navigate('/deliveries?tab=tasks') }] });
    } catch (e: any) { setError(e.message || 'Could not assign the MRL.'); } finally { setBusy(false); }
  };

  return (
    <>
      <DataCard<StagedMrlSummary> title="MRLs to assign" description="Confirm the release of an MRL and assign it to a Sub-Department user to verify."
        columns={columns} data={rows} keyField="mrlNumber" isLoading={loading && !data} searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search by MRL, MRQ, project..."
        onRefresh={load} refreshing={loading} emptyMessage="No MRL is waiting to be assigned." />
      {pick && (
        <Modal title={`Confirm release and assign MRL ${pick.mrlNumber}`} busy={busy} error={error} onClose={() => setPick(null)}
          footer={<>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => setPick(null)}>Cancel</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy || !sub || !assignee || (!!approveId && approveWhy.trim().length < 5)} onClick={submit}>{busy ? <Loading variant="button" label="Assigning..." /> : 'Confirm & assign'}</button>
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
            <PersonSelect value={assignee} onChange={setAssignee} options={people.map(a => ({ email: a.email, label: `${a.name || a.email} (${a.email})` }))} />
            {sub && people.length === 0 && <div className="form-text text-warning-emphasis">No Sub-Department account is listed for {sub}. Add the sub-department to that person's row in the Accounts sheet (Subdepartment column), then refresh.</div>}
          </div>
          {otherProjects.length > 0 && (
            <details className="mt-3">
              <summary className="small text-muted" role="button">This MRL is for {pick.classificationId || 'its own project'}. Charge it to another project?</summary>
              <div className="mt-2">
                <Select optional noneLabel="No, only the matching project" className="form-select form-select-sm" value={approveId} onChange={e => setApproveId(e.target.value)}>
                  {otherProjects.map(a => <option key={a.Activity_ID} value={a.Activity_ID}>{a.Activity_ID} · {a.Activity_Name} ({a.ProcInv_Class_Ref})</option>)}
                </Select>
                {approveId && (
                  <input className="form-control form-control-sm mt-2" placeholder="Why is this right? (required, saved with the task)" value={approveWhy} onChange={e => setApproveWhy(e.target.value)} />
                )}
                <div className="form-text">Only that activity becomes available to the verifier.</div>
              </div>
            </details>
          )}
        </Modal>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Verification dialog
// ---------------------------------------------------------------------------
interface LineForm { recv: string; ret: string; type: string; details: string; delivered: string; shortRes: 'OPEN' | 'CLOSED'; cost?: string; base?: boolean; spot?: string }

const VerifyModal: React.FC<{ task: MrlTask; onClose: () => void; onDone: () => void }> = ({ task, onClose, onDone }) => {
  const dialog = useDialog();
  const names = useStorageNames();
  const lines = task.items.filter(l => l.Line_Status === 'AWAITING');
  const fresh = (): Record<string, LineForm> => Object.fromEntries(lines.map(l => [l.Receipt_Line_ID, { recv: String(l.Released_Qty), ret: '', type: '', details: '', delivered: '', shortRes: 'OPEN' as const }]));
  // what was typed stays in this browser until the delivery is posted, so closing the window by mistake loses nothing
  const savedKey = `jjjei_verify|${getCurrentUser()?.email || ''}|${task.Receipt_ID}`;
  const saved = (() => { try { const v = JSON.parse(localStorage.getItem(savedKey) || 'null'); return v && lines.every(l => v.form?.[l.Receipt_Line_ID]) ? v as { form: Record<string, LineForm>; dest: Dest } : null; } catch { return null; } })();
  const [restored, setRestored] = useState(!!saved);
  const [form, setForm] = useState<Record<string, LineForm>>(() => saved?.form || fresh());
  const [dest, setDest] = useState<Dest>(() => saved?.dest || EMPTY_DEST);
  useEffect(() => {
    try {
      if (JSON.stringify({ form, dest }) === JSON.stringify({ form: fresh(), dest: EMPTY_DEST })) localStorage.removeItem(savedKey);
      else localStorage.setItem(savedKey, JSON.stringify({ form, dest }));
    } catch { /* private mode: not saved */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dest]);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setError(''); }, [form, dest]); // a red message about the last attempt goes away as soon as something is changed
  const preset = task.Status === 'DELEGATED';
  // where each line sits inside the area: only when the delivery goes to a warehouse area that has spots
  const areaId = preset ? (task.Destination_Type === 'WAREHOUSE' ? task.Area_ID || '' : '') : (dest.destinationType === 'WAREHOUSE' ? dest.areaId : '');
  const spots = names.spots(areaId);
  const set = (id: string, patch: Partial<LineForm>) => setForm(f => ({ ...f, [id]: { ...f[id], ...patch } }));
  const short = (l: TaskLine) => { const f = form[l.Receipt_Line_ID]; return Math.max(0, n(l.Released_Qty) - n(f.recv) - n(f.ret)); };
  const over = (l: TaskLine) => { const f = form[l.Receipt_Line_ID]; return n(f.recv) + n(f.ret) > n(l.Released_Qty); };
  // price: roles that cannot see costs get no price keys, so they see no price column and cannot type one
  const pricing = lines.some(l => l.price && 'unitCost' in l.price);
  const catalogPrice = (l: TaskLine) => n(l.price?.unitCost);
  const unpriced = lines.filter(l => n(form[l.Receipt_Line_ID].recv) > 0 && catalogPrice(l) <= 0 && n(form[l.Receipt_Line_ID].cost) <= 0).length;
  const needsReason = lines.some(l => short(l) > 0 && form[l.Receipt_Line_ID].shortRes === 'CLOSED' && !form[l.Receipt_Line_ID].details.trim());
  const nothingReceived = lines.every(l => n(form[l.Receipt_Line_ID].recv) === 0); // a whole return posts nothing, so no destination is needed
  const unmappedReceived = lines.some(l => (!l.Item_ID || l.Item_ID === 'UNMAPPED') && n(form[l.Receipt_Line_ID].recv) > 0);
  const ready = (preset || nothingReceived || (destReady(dest) && !blocked)) && !needsReason && !unmappedReceived;

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await apiRequest<{ followUpReceiptId: string | null; short: number; over: number; returned: number; transactionId: string | null; mrtNumber: string | null }>('receiving:verify', {
        receiptId: task.Receipt_ID,
        ...(preset ? {} : { destinationType: dest.destinationType || 'WAREHOUSE', warehouseLocation: dest.warehouseLocation, areaId: dest.areaId, activityId: dest.activityId }),
        lines: lines.map(l => { const f = form[l.Receipt_Line_ID]; return { receiptLineId: l.Receipt_Line_ID, receivedQty: n(f.recv), returnedQty: n(f.ret), mismatchType: f.type, mismatchDetails: f.details, deliveredItemName: f.delivered, shortResolution: f.shortRes, ...(f.spot && spots.some(x => x.id === f.spot) && n(f.recv) > 0 ? { storageId: f.spot } : {}), ...(n(f.cost) > 0 && n(f.recv) > 0 ? { unitCost: n(f.cost), saveAsBasePrice: !!f.base } : {}) }; })
      });
      const where = preset
        ? (task.Destination_Type === 'ACTIVITY' ? `activity ${task.Activity_Name || task.Activity_ID}` : `warehouse ${task.Warehouse_Name || task.Warehouse_Location}${task.Area_ID ? ` · ${task.Area_Name || task.Area_ID}` : ''}`)
        : (dest.destinationType === 'ACTIVITY' ? `activity ${dest.activityId}` : `warehouse ${names.warehouse(dest.warehouseLocation)}${dest.areaId ? ` · ${names.area(dest.areaId)}` : ''}`);
      try { localStorage.removeItem(savedKey); } catch { /* nothing to clear */ }
      onDone();
      const links = [
        ...(res.mrtNumber ? [{ label: 'See the return voucher', to: '/deliveries?tab=returns' }] : []),
        ...(res.followUpReceiptId ? [{ label: 'See the missing items', to: '/deliveries?tab=tasks' }] : []),
        ...(!res.transactionId ? [] : dest.destinationType === 'ACTIVITY' || task.Destination_Type === 'ACTIVITY' ? [{ label: 'Open the activity', to: `/activities/${preset ? task.Activity_ID : dest.activityId}?tab=usage` }] : [{ label: 'See warehouse stock', to: '/inventory' }])
      ];
      await dialog.alert({ title: 'Delivery verified', message: verifySummary(task, lines, form, where, res, task.Receiver_Name || task.Receiver_ID), links, confirmText: 'Done' });
    } catch (e: any) { setError(e.message || 'Verification failed.'); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={`Verify MRL ${task.Source_Reference}`} busy={busy} error={error} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => (ready ? submit() : setError(unmappedReceived ? 'A line is not in the catalog yet, so it cannot be received. Use "Return this line" on it, or ask a Head to add the item.' : !preset && !destReady(dest) ? 'Choose where the delivery goes: the warehouse or an activity.' : blocked ? 'That activity belongs to another project. Choose the matching activity, or ask a Head to approve it.' : 'Say why the shortage is closed (Details).'))}>{busy ? <Loading variant="button" label="Posting..." /> : 'Verify and post'}</button>
      </>}>
      <div className="small text-muted mb-2">{task.Project_Name} · MRQ {task.MRQ_Number}{task.Sub_Department ? ` · ${task.Sub_Department}` : ''}</div>
      {restored && (
        <div className="alert alert-info py-2 small d-flex justify-content-between align-items-center gap-2">
          <span>Restored your unsaved entries.</span>
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => { setForm(fresh()); setDest(EMPTY_DEST); setRestored(false); }}>Start over</button>
        </div>
      )}
      <div className="table-responsive mb-3">
        <table className="table table-sm align-middle mb-0 table-stack" style={{ fontSize: '0.82rem' }}>
          <thead><tr><th>Item</th><th className="text-end">Released</th><th style={{ width: 90 }}>Received</th><th style={{ width: 90 }}>Return</th><th>Mismatch</th><th>Details / delivered item</th>{pricing && <th>Price</th>}{spots.length > 0 && <th>Spot</th>}<th>Shortage</th></tr></thead>
          <tbody>
            {lines.map(l => {
              const f = form[l.Receipt_Line_ID];
              const s = short(l);
              return (
                <tr key={l.Receipt_Line_ID}>
                  <td data-label="Item">{l.Item_Name}<div className="text-muted small">{l.UOM}</div>{(!l.Item_ID || l.Item_ID === 'UNMAPPED') && (
                    <div className="small text-warning-emphasis">
                      Not in the catalog yet, so it cannot be received. Return it, or ask a Head to add the item to the catalog.
                      {n(f.recv) > 0 && <button type="button" className="btn btn-outline-warning btn-sm ms-2 py-0" onClick={() => set(l.Receipt_Line_ID, { recv: '0', ret: String(l.Released_Qty), type: 'ITEM', details: f.details || 'Not in the catalog' })}>Return this line</button>}
                    </div>
                  )}</td>
                  <td className="text-end" data-label="Released">{l.Released_Qty}</td>
                  <td data-label="Received"><input type="number" min="0" step="any" className="form-control form-control-sm" aria-label="Received" value={f.recv} onChange={e => set(l.Receipt_Line_ID, { recv: e.target.value })} /></td>
                  <td data-label="Return"><input type="number" min="0" step="any" className="form-control form-control-sm" aria-label="Return" value={f.ret} onChange={e => set(l.Receipt_Line_ID, { ret: e.target.value })} /></td>
                  <td data-label="Mismatch"><Select optional noneLabel="None" className="form-select form-select-sm" value={f.type} onChange={e => set(l.Receipt_Line_ID, { type: e.target.value })}>{TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Select></td>
                  <td data-label="Details">
                    <input type="text" className="form-control form-control-sm mb-1" placeholder="What is different" value={f.details} onChange={e => set(l.Receipt_Line_ID, { details: e.target.value })} />
                    {n(f.ret) > 0 && <input type="text" className="form-control form-control-sm" placeholder="Item that actually arrived" value={f.delivered} onChange={e => set(l.Receipt_Line_ID, { delivered: e.target.value })} />}
                  </td>
                  {pricing && (
                    <td style={{ minWidth: 150 }} data-label="Price">
                      {n(f.recv) <= 0 ? <span className="text-muted">-</span> : catalogPrice(l) > 0
                        ? <span>{fmtMoney(catalogPrice(l))}<div className="text-muted small">{l.price?.supplierName || (l.price?.source === 'BASE' ? 'Base price' : 'Catalog')}</div></span>
                        : (
                          <>
                            <input type="number" min="0" step="any" className="form-control form-control-sm" aria-label="Price each" placeholder="No price: enter one" value={f.cost || ''} onChange={e => set(l.Receipt_Line_ID, { cost: e.target.value })} />
                            {n(f.cost) > 0 && <label className="form-check small mt-1 mb-0"><input type="checkbox" className="form-check-input" checked={!!f.base} onChange={e => set(l.Receipt_Line_ID, { base: e.target.checked })} /> Keep as the base price</label>}
                          </>
                        )}
                    </td>
                  )}
                  {spots.length > 0 && (
                    <td data-label="Spot" style={{ minWidth: 140 }}>
                      {n(f.recv) <= 0 ? <span className="text-muted">-</span> : (
                        <Select optional noneLabel="Whole area" className="form-select form-select-sm" value={spots.some(x => x.id === f.spot) ? f.spot : ''} onChange={e => set(l.Receipt_Line_ID, { spot: e.target.value })}>
                          {spots.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </Select>
                      )}
                    </td>
                  )}
                  <td data-label="Shortage">
                    {s > 0 ? (
                      <>
                        <div className="text-warning-emphasis">{s} short</div>
                        <Select className="form-select form-select-sm" value={f.shortRes} onChange={e => set(l.Receipt_Line_ID, { shortRes: e.target.value as 'OPEN' | 'CLOSED' })}>
                          <option value="OPEN">Expect the missing items</option>
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
      {pricing && unpriced > 0 && <div className="alert alert-warning py-2 small">{unpriced} line{unpriced === 1 ? '' : 's'} will be posted without a price (value ₱0.00 until it is set). Enter a price above, or set it later under Deliveries, Unpriced.</div>}
      <div className="fw-semibold small mb-1">Destination</div>
      {preset
        ? <div className="small">{task.Destination_Type === 'ACTIVITY' ? `Direct to activity ${task.Activity_Name || task.Activity_ID}` : `Warehouse ${task.Warehouse_Name || task.Warehouse_Location}${task.Area_ID ? ` · ${task.Area_Name || task.Area_ID}` : ''}`} <span className="text-muted">(set when it was delegated to you)</span></div>
        : <DestinationFields value={dest} onChange={setDest} classification={task.Classification_ID} approvedActivity={task.approvedActivity} onBlockedChange={setBlocked} />}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Delegate / reassign dialogs
// ---------------------------------------------------------------------------
const DelegateModal: React.FC<{ task: MrlTask; onClose: () => void; onDone: () => void }> = ({ task, onClose, onDone }) => {
  const dialog = useDialog();
  const names = useStorageNames();
  const accounts = useDirectory();
  const [fms, setFms] = useState('');
  const [error, setError] = useState('');
  const [dest, setDest] = useState<Dest>(EMPTY_DEST);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const people = accounts.filter(a => has(a.roles, 'FMS') && has(a.departments, 'Facilities') && has(a.subdepartments, task.Sub_Department));
  const submit = async () => {
    setBusy(true);
    try {
      await apiRequest('receiving:delegate', { receiptId: task.Receipt_ID, fmsId: fms, destinationType: dest.destinationType, warehouseLocation: dest.warehouseLocation, areaId: dest.areaId, activityId: dest.activityId });
      onDone();
      await dialog.alert({ title: 'MRL delegated', message: delegateSummary(task.Source_Reference, people.find(a => a.email === fms)?.name || fms, dest.destinationType === 'ACTIVITY' ? `activity ${dest.activityId}` : `warehouse ${names.warehouse(dest.warehouseLocation)}${dest.areaId ? ` · ${names.area(dest.areaId)}` : ''}`), confirmText: 'Done' });
    } catch (e: any) { setError(e.message || 'Could not delegate.'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Delegate MRL ${task.Source_Reference} to an FMS`} busy={busy} error={error} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !fms || !destReady(dest) || blocked} onClick={submit}>{busy ? <Loading variant="button" label="Delegating..." /> : 'Delegate'}</button>
      </>}>
      <div className="mb-3">
        <label className="form-label small fw-semibold">FMS of {task.Sub_Department || 'the sub-department'} *</label>
        <PersonSelect value={fms} onChange={setFms} options={people.map(a => ({ email: a.email, label: `${a.name || a.email} (${a.email})` }))} />
        {people.length === 0 && <div className="form-text text-warning-emphasis">No FMS account is listed for this sub-department.</div>}
      </div>
      <div className="fw-semibold small mb-1">Destination (required) *</div>
      <DestinationFields value={dest} onChange={setDest} classification={task.Classification_ID} approvedActivity={task.approvedActivity} onBlockedChange={setBlocked} />
    </Modal>
  );
};

const ReassignModal: React.FC<{ task: MrlTask; onClose: () => void; onDone: () => void }> = ({ task, onClose, onDone }) => {
  const toast = useToast();
  const accounts = useDirectory();
  const [who, setWho] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const people = accounts.filter(a => has(a.roles, 'Sub-Department') && has(a.departments, 'Facilities') && has(a.subdepartments, task.Sub_Department));
  const submit = async () => {
    setBusy(true);
    try { await apiRequest('receiving:reassign', { receiptId: task.Receipt_ID, assigneeId: who }); toast.success('Task reassigned.'); onDone(); }
    catch (e: any) { setError(e.message || 'Could not reassign.'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Reassign MRL ${task.Source_Reference}`} busy={busy} error={error} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !who} onClick={submit}>{busy ? <Loading variant="button" label="Saving..." /> : 'Reassign'}</button>
      </>}>
      <label className="form-label small fw-semibold">Assign to *</label>
      <PersonSelect value={who} onChange={setWho} options={people.map(a => ({ email: a.email, label: `${a.name || a.email} (${a.email})` }))} />
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
  const dialog = useDialog();
  /** Close a balance or cancel an assignment: both need a reason. */
  const askReason = async (kind: 'close' | 'cancel', t: MrlTask) => {
    const reason = await dialog.prompt(kind === 'close'
      ? { title: `Close the missing items of MRL ${t.Source_Reference}`, label: 'Why are the missing items closed? (no more is coming)', confirmText: 'Close missing items' }
      : { title: `Cancel the assignment of MRL ${t.Source_Reference}`, label: 'Why is this assignment cancelled?', confirmText: 'Cancel assignment', danger: true });
    if (reason) await act(kind === 'close' ? 'receiving:closeBalance' : 'receiving:cancel', { receiptId: t.Receipt_ID, reason }, kind === 'close' ? 'Missing items closed.' : 'Assignment cancelled.');
  };

  const load = useCallback(() => {
    setLoading(true);
    apiRequest<MrlTask[]>('receiving:getAssigned', { status: view === 'all' ? 'ALL' : '' })
      .then(r => { setTasks(Array.isArray(r) ? r : []); })
      .catch(e => toast.error(e.message || 'Could not load the tasks.')).finally(() => setLoading(false));
  }, [view, toast]);
  useEffect(load, [load, refreshKey]);
  useEffect(() => { onCount?.(tasks.filter(t => t.canVerify).length); }, [tasks, onCount]);

  const done = () => {
    // a verified task leaves the list at once; the reload (which can take a while) runs after and brings any follow-up task
    if (verifying) { const id = verifying.Receipt_ID; setTasks(ts => ts.filter(x => x.Receipt_ID !== id)); }
    setVerifying(null); setDelegating(null); setReassigning(null); invalidateCache('receiving:'); invalidateCache('inventory:stock'); load(); onChanged();
  };
  const act = async (action: string, payload: object, msg: string) => {
    try { await apiRequest(action, payload); toast.success(msg); done(); } catch (e: any) { toast.error(e.message || 'Action failed.'); }
  };
  const rows = tasks.filter(t => !search.trim() || `${t.Source_Reference} ${t.MRQ_Number} ${t.Project_Name} ${t.Receiver_ID} ${t.Receiver_Name || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  const columns: Column<MrlTask>[] = [
    { key: 'Source_Reference', label: 'MRL', sortable: true, minWidth: '90px', render: t => <>{t.Source_Reference}{t.Parent_Receipt_ID && <span className="badge text-bg-light border fw-normal ms-1">missing items</span>}</> },
    { key: 'Project_Name', label: 'Project', minWidth: '180px', render: t => t.Project_Name || 'No Data' },
    { key: 'Sub_Department', label: 'Sub-Department', minWidth: '130px', render: t => t.Sub_Department || 'No Data' },
    { key: 'Receiver_ID', label: 'With', minWidth: '170px', render: t => t.Status === 'CONFIRMED' || t.Status === 'CANCELLED' ? 'No Data' : (t.Receiver_Name || t.Receiver_ID) },
    { key: 'Status', label: 'Status', align: 'center', minWidth: '100px', render: t => STATUS_LABEL[t.Status] || t.Status },
    { key: 'items', label: 'Lines', align: 'right', minWidth: '60px', render: t => String(t.items.length) },
    {
      key: 'actions', label: '', align: 'right', minWidth: '320px', render: t => (
        <div className="d-flex justify-content-end flex-wrap gap-1">
          {t.canVerify && <button type="button" className="btn btn-primary btn-sm" onClick={() => setVerifying(t)}>Verify</button>}
          {t.canDelegate && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDelegating(t)}>Delegate to FMS</button>}
          {t.canTakeBack && <button type="button" className="btn btn-secondary btn-sm" onClick={() => act('receiving:reassign', { receiptId: t.Receipt_ID, takeBack: true }, 'Task taken back.')}>Take back</button>}
          {t.canVerify && t.Parent_Receipt_ID && !access.fieldOnly && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => askReason('close', t)}>Close missing items</button>}
          {access.isAdmin && (t.Status === 'ASSIGNED' || t.Status === 'DELEGATED') && (
            <ActionMenu label="More actions" actions={[
              { key: 'reassign', label: 'Reassign to someone else', onClick: () => setReassigning(t) },
              { key: 'cancel', label: t.Parent_Receipt_ID ? 'Cancel the missing-items task' : 'Cancel this assignment', danger: true, onClick: () => askReason('cancel', t) }
            ]} />
          )}
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
