/**
 * @file ManageStorage.tsx
 * @description Storage management tab: the areas of a warehouse, or the shelves, levels, containers and spaces of an area.
 * Everyone can read it; Head and Super Admin can add, edit and deactivate (through `config:saveRecord` on Warehouse_Storage,
 * which validates the parent rules and the owner sub-department).
 *
 * Shelves, containers and spaces are labels: stock is counted per area, not per shelf.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { invalidateCache } from '../../services/cache';
import { getCurrentUser, isUserHeadOrAdmin } from '../../services/auth';
import { getAccess, hideCosts } from '../../services/access';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../ConfirmModal';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';
import { Select } from '../Select';
import { Field } from '../form/Field';
import { FormLegend, FormSection } from '../form/FormSection';
import { FormSubmit } from '../form/FormSubmit';
import { useForm, type FormErrors } from '../form/useForm';
import type { EntityScopeType, EntityStorageNode, StorageNodesResponse, StorageOptions } from '../../types';
import { SpotStockModal } from './SpotStockModal';
import { entityPath, peso } from './entityPaths';
import { useEntityData } from './useEntity';
import { CHILD_TYPES, PARENTS, TYPE_LABEL, capacityText, childTypesOf, type NodeType } from './storageTypes';
import { StorageTree } from './StorageTree';
import { StorageByOwner } from './StorageByOwner';
import { RackModal } from './RackModal';


interface Props {
  scopeType: Extract<EntityScopeType, 'WAREHOUSE' | 'AREA'>;
  scopeRef: string;
  /** the warehouse these records belong to */
  warehouseId: string;
  /** for an area page: the area itself, so shelves and containers can sit directly in it */
  root?: { storageId: string; name: string };
}

interface Values { name: string; type: NodeType; parentId: string; shelfNumber: string; level: string; owner: string; description: string; status: string; capacity: string; capacityUnit: string }

export const ManageStorage: React.FC<Props> = ({ scopeType, scopeRef, warehouseId, root }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<StorageNodesResponse>('getStorage', scopeType, scopeRef);
  const admin = isUserHeadOrAdmin(getCurrentUser());
  const toast = useToast();
  const [editing, setEditing] = useState<EntityStorageNode | 'new' | null>(null);
  const [retire, setRetire] = useState<EntityStorageNode | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const isWarehouse = scopeType === 'WAREHOUSE';
  const [view, setView] = useState<'list' | 'tree' | 'owner'>(isWarehouse ? 'list' : 'tree');
  const [presetParent, setPresetParent] = useState('');
  const [rackOpen, setRackOpen] = useState(false);
  const [viewing, setViewing] = useState<{ spotId: string; title: string } | null>(null);
  const [subs, setSubs] = useState<string[]>([]);
  useEffect(() => {
    if (!isWarehouse) return;
    apiRequest<StorageOptions>('receiving:getStorageOptions').then(o => setSubs(o.subDepartments || [])).catch(() => { /* groups then show only owners that have areas */ });
  }, [isWarehouse]);

  const nodes = useMemo(() => data?.nodes || [], [data]);
  const depth = (n: EntityStorageNode): number => {
    let d = 0; let p = n.parentStorageId;
    while (p && p !== scopeRef && d < 6) { const up = nodes.find(x => x.storageId === p); if (!up) break; d++; p = up.parentStorageId; }
    return d;
  };
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nodes.filter(n => !q || [n.name, n.shelfNumber, n.storageId, n.ownerSubDepartment, n.storageType].join(' ').toLowerCase().includes(q));
  }, [nodes, search]);

  const afterChange = async () => { invalidateCache('entity:'); invalidateCache('config:Warehouse_Storage'); await reload(); };
  const doRetire = async () => {
    if (!retire) return;
    setBusy(true);
    try {
      await apiRequest('config:deleteRecord', { table: 'Warehouse_Storage', idField: 'Storage_ID', id: retire.storageId });
      toast.success(`${retire.name || retire.storageId} was deactivated.`);
      setRetire(null);
      await afterChange();
    } catch (e: any) { toast.error(e.message || 'Could not deactivate.'); } finally { setBusy(false); }
  };

  const actionsCol: Column<EntityStorageNode> = {
    key: 'actions', label: '', align: 'right', minWidth: '150px', render: n => (
      <div className="d-flex justify-content-end gap-1">
        <button type="button" className="btn btn-secondary btn-sm py-0" onClick={() => setEditing(n)}>Edit</button>
        {n.status !== 'INACTIVE' && <button type="button" className="btn btn-secondary btn-sm py-0" onClick={() => setRetire(n)}>Deactivate</button>}
      </div>
    )
  };
  const columns: Column<EntityStorageNode>[] = scopeType === 'WAREHOUSE' ? [
    { key: 'name', label: 'Area', sortable: true, minWidth: '200px', render: n => (
      <div><Link to={entityPath('AREA', n.storageId)} className="fw-semibold text-decoration-none">{n.name || n.storageId}</Link><div className="small text-muted">{n.storageId}</div></div>
    ) },
    { key: 'ownerSubDepartment', label: 'Owner', sortable: true, minWidth: '140px', render: n => n.ownerSubDepartment || 'Common area' },
    { key: 'items', label: 'Items', align: 'right', sortable: true, minWidth: '80px' },
    { key: 'stockValue', label: 'Stock value', align: 'right', sortable: true, minWidth: '120px', render: n => peso(n.stockValue) },
    { key: 'status', label: 'Status', align: 'center', minWidth: '90px' },
    ...(admin ? [actionsCol] : [])
  ] : [
    { key: 'name', label: 'Name', sortable: true, minWidth: '220px', render: n => (
      <div style={{ paddingLeft: `${depth(n) * 16}px` }}><span className="fw-semibold text-dark">{n.name || n.shelfNumber || n.storageId}</span><div className="small text-muted">{n.storageId}</div></div>
    ) },
    { key: 'storageType', label: 'Type', sortable: true, minWidth: '100px', render: n => TYPE_LABEL[n.storageType] },
    { key: 'shelfNumber', label: 'Shelf no.', minWidth: '90px', render: n => n.shelfNumber || '–' },
    { key: 'level', label: 'Level', minWidth: '80px', render: n => n.level || '–' },
    { key: 'capacity', label: 'Capacity', align: 'right', sortable: true, minWidth: '100px', render: n => capacityText(n) || '–' },
    { key: 'status', label: 'Status', align: 'center', minWidth: '90px' },
    ...(admin ? [actionsCol] : [])
  ];

  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  const openAdd = (parentId = '') => { setPresetParent(parentId); setEditing('new'); };
  const title = isWarehouse ? 'Manage areas' : 'Manage shelves and containers';
  const description = isWarehouse ? 'Areas of this warehouse. Stock is counted per area.' : 'Shelves, levels, containers and spaces inside this area. They are labels: stock is counted for the whole area.';
  const switcher = (
    <div className="btn-group btn-group-sm" role="group" aria-label="View">
      {(isWarehouse ? [['list', 'List'], ['owner', 'By sub-department']] : [['tree', 'Tree'], ['list', 'List']]).map(([k, l]) => (
        <button key={k} type="button" className={`btn ${view === k ? 'btn-secondary' : 'btn-outline-secondary'}`} aria-pressed={view === k} onClick={() => setView(k as typeof view)}>{l}</button>
      ))}
    </div>
  );
  const addActions = admin ? [
    ...(!isWarehouse && root ? [{ key: 'rack', label: 'Add rack', icon: 'bi-bookshelf', onClick: () => setRackOpen(true) }] : []),
    { key: 'add', label: isWarehouse ? 'Add area' : 'Add', icon: 'bi-plus-lg', onClick: () => openAdd(root?.storageId || '') }
  ] : [];
  const access = getAccess(getCurrentUser());
  return (
    <>
      {view === 'list' ? (
        <DataCard
          title={title} description={description}
          columns={hideCosts(columns, access)} data={rows} keyField="storageId" isLoading={loading && !data}
          searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search..."
          onRefresh={reload} refreshing={refreshing} toolbar={switcher} actions={addActions}
          emptyMessage={isWarehouse ? 'No areas yet.' : 'Nothing here yet.'}
        />
      ) : (
        <div className="card border shadow-sm bg-white overflow-hidden">
          <div className="card-header bg-white py-3 px-3 px-md-4 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="min-w-0"><h5 className="fw-bold mb-0 text-dark">{title}</h5><div className="small text-muted">{description}</div></div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {switcher}
              {addActions.map(a => <button key={a.key} type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" onClick={a.onClick}><i className={`bi ${a.icon}`}></i>{a.label}</button>)}
            </div>
          </div>
          {loading && !data ? <div className="text-center text-muted small py-5">Loading...</div>
            : view === 'tree' && root ? <StorageTree nodes={nodes} rootId={root.storageId} rootName={root.name} admin={admin} onEdit={setEditing} onRetire={setRetire} onAdd={openAdd} onViewItems={data?.tracked ? (spotId, title) => setViewing({ spotId, title }) : undefined} unassigned={data?.tracked ? data.unassigned : undefined} />
              : <StorageByOwner areas={nodes} subDepartments={subs} showCosts={access.canSeeCosts} admin={admin} onEdit={setEditing} />}
        </div>
      )}
      {editing && (
        <StorageNodeModal
          node={editing === 'new' ? null : editing} scopeType={scopeType} warehouseId={warehouseId} root={root} nodes={nodes} presetParent={editing === 'new' ? presetParent : ''}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await afterChange(); }}
        />
      )}
      {viewing && root && <SpotStockModal areaId={root.storageId} areaName={root.name} warehouseId={warehouseId} spotId={viewing.spotId} title={viewing.title} nodes={nodes} canMove={access.isCustodian} onClose={() => setViewing(null)} onChanged={() => { invalidateCache('entity:'); reload(); }} />}
      {rackOpen && root && <RackModal warehouseId={warehouseId} area={root} onClose={() => setRackOpen(false)} onSaved={async () => { setRackOpen(false); await afterChange(); }} />}
      <ConfirmModal
        isOpen={!!retire} title="Deactivate" isDanger isLoading={busy} confirmText="Deactivate"
        message={`Deactivate ${retire?.name || retire?.storageId}? It stays in the history but can no longer be chosen. You can switch it back to ACTIVE by editing it.`}
        onConfirm={doRetire} onCancel={() => setRetire(null)}
      />
    </>
  );
};

interface ModalProps {
  node: EntityStorageNode | null;
  scopeType: Props['scopeType'];
  warehouseId: string;
  root?: Props['root'];
  nodes: EntityStorageNode[];
  presetParent?: string;
  onClose: () => void;
  onSaved: () => void;
}

const StorageNodeModal: React.FC<ModalProps> = ({ node, scopeType, warehouseId, root, nodes, presetParent = '', onClose, onSaved }) => {
  const toast = useToast();
  const isArea = scopeType === 'WAREHOUSE';
  const parentType = (id: string): NodeType => (root && id === root.storageId ? 'AREA' : nodes.find(n => n.storageId === id)?.storageType || 'AREA');
  const [values, setValues] = useState<Values>(() => {
    const parentId = node?.parentStorageId || (isArea ? '' : presetParent || root?.storageId || '');
    return {
      name: node?.name || '', type: node?.storageType || (isArea ? 'AREA' : (childTypesOf(parentType(parentId))[0] || 'SHELF')), parentId,
      shelfNumber: node?.shelfNumber || '', level: node?.level || '', owner: node?.ownerSubDepartment || '', description: node?.description || '', status: node?.status || 'ACTIVE',
      capacity: node?.capacity === null || node?.capacity === undefined ? '' : String(node.capacity), capacityUnit: node?.capacityUnit || ''
    };
  });
  const [ack, setAck] = useState(false);
  const ownerChanged = !!node && isArea && node.ownerSubDepartment !== values.owner;
  const needsAck = ownerChanged && (node?.items || 0) > 0;
  const [subs, setSubs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<Values>) => setValues(v => ({ ...v, ...p }));

  useEffect(() => {
    if (!isArea) return;
    apiRequest<StorageOptions>('receiving:getStorageOptions').then(o => setSubs(o.subDepartments || [])).catch(() => { /* the owner list stays empty; the API still validates */ });
  }, [isArea]);

  // possible parents: the area itself plus its nodes, limited to the types the chosen type may sit in
  const parentOptions = [
    ...(root ? [{ storageId: root.storageId, name: root.name, storageType: 'AREA' as NodeType }] : []),
    ...nodes.filter(n => n.storageId !== node?.storageId && n.status !== 'INACTIVE')
  ].filter(p => PARENTS[values.type].includes(p.storageType));

  const validate = (v: Values): FormErrors => {
    const e: FormErrors = {};
    if (!v.name.trim() && !v.shelfNumber.trim()) e.name = 'Enter a name or a shelf number.';
    if (!isArea && !v.parentId) e.parentId = `Choose where this ${TYPE_LABEL[v.type].toLowerCase()} sits.`;
    if (v.capacity.trim() !== '' && !(Number.isFinite(Number(v.capacity)) && Number(v.capacity) >= 0)) e.capacity = 'Enter a number, zero or more.';
    return e;
  };
  const form = useForm(values, validate);

  const save = async () => {
    if (needsAck && !ack) { toast.error('Tick the box to confirm the owner change.'); return; }
    setSaving(true);
    try {
      await apiRequest('config:saveRecord', { table: 'Warehouse_Storage', idField: 'Storage_ID', record: {
        Storage_ID: node?.storageId || '', Warehouse_Location: warehouseId, Storage_Type: values.type, Parent_Storage_ID: isArea ? '' : values.parentId,
        Name: values.name.trim(), Shelf_Number: values.shelfNumber.trim(), Level: values.level.trim(), Owner_SubDepartment: values.type === 'AREA' ? values.owner : '',
        Description: values.description.trim(), Status: values.status,
        Capacity: values.capacity.trim() === '' ? '' : Number(values.capacity), Capacity_Unit: values.capacity.trim() === '' ? '' : values.capacityUnit.trim()
      } });
      toast.success(node ? 'Saved.' : 'Added.');
      onSaved();
    } catch (e: any) { toast.error(e.message || 'Could not save.'); form.touchAll(); } finally { setSaving(false); }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <h6 className="modal-title fw-bold mb-0">{node ? 'Edit' : 'Add'} {isArea ? 'area' : TYPE_LABEL[values.type].toLowerCase()}</h6>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>
          <div className="modal-body p-4">
            <FormLegend />
            <FormSection>
              {!isArea && (
                <Field form={form} name="type" label="Type" required className="col-md-6">
                  <Select className="form-select form-select-sm" value={values.type} disabled={!!node}
                    onChange={e => set({ type: e.target.value as NodeType, parentId: '' })}>
                    {CHILD_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </Select>
                </Field>
              )}
              <Field form={form} name="name" label="Name" required={isArea} className={isArea ? 'col-12' : 'col-md-6'} hint={isArea ? undefined : 'Or a shelf number.'}>
                <input className="form-control form-control-sm" value={values.name} onChange={e => set({ name: e.target.value })} />
              </Field>
              {!isArea && (
                <>
                  <Field form={form} name="parentId" label="Sits in" required className="col-12">
                    <Select className="form-select form-select-sm" value={values.parentId} onChange={e => set({ parentId: e.target.value })}>
                      {parentOptions.map(p => <option key={p.storageId} value={p.storageId}>{TYPE_LABEL[p.storageType]}: {p.name || p.storageId}</option>)}
                    </Select>
                  </Field>
                  <Field form={form} name="shelfNumber" label="Shelf number" className="col-md-6">
                    <input className="form-control form-control-sm" value={values.shelfNumber} onChange={e => set({ shelfNumber: e.target.value })} />
                  </Field>
                  <Field form={form} name="level" label="Level" className="col-md-6">
                    <input className="form-control form-control-sm" value={values.level} onChange={e => set({ level: e.target.value })} />
                  </Field>
                </>
              )}
              {isArea && (
                <Field form={form} name="owner" label="Owner sub-department" className="col-12" hint="Leave as None for a common area.">
                  <Select optional noneLabel="None (common area)" className="form-select form-select-sm" value={values.owner} onChange={e => set({ owner: e.target.value })}>
                    {values.owner && !subs.includes(values.owner) && <option value={values.owner}>{values.owner}</option>}
                    {subs.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
              )}
              {needsAck && (
                <div className="col-12">
                  <div className="alert alert-warning small mb-0">
                    This area holds {node?.items} item{node?.items === 1 ? '' : 's'}. Past records keep the old owner ({node?.ownerSubDepartment || 'common area'}); new movements here will count for {values.owner || 'the common area'}.
                    <div className="form-check mt-2"><input className="form-check-input" type="checkbox" id="owner-ack" checked={ack} onChange={e => setAck(e.target.checked)} /><label className="form-check-label" htmlFor="owner-ack">I understand</label></div>
                  </div>
                </div>
              )}
              <Field form={form} name="capacity" label="Capacity" className="col-md-6" hint="Optional. How much it can hold.">
                <input className="form-control form-control-sm" inputMode="decimal" value={values.capacity} onChange={e => set({ capacity: e.target.value })} />
              </Field>
              <Field form={form} name="capacityUnit" label="Capacity unit" className="col-md-6" hint="For example kg, boxes, pallets.">
                <input className="form-control form-control-sm" list="capacity-units" value={values.capacityUnit} onChange={e => set({ capacityUnit: e.target.value })} />
              </Field>
              <datalist id="capacity-units">{['kg', 'pcs', 'boxes', 'pallets', 'm3'].map(u => <option key={u} value={u} />)}</datalist>
              <Field form={form} name="description" label="Description" className="col-12">
                <textarea className="form-control form-control-sm" rows={2} value={values.description} onChange={e => set({ description: e.target.value })} />
              </Field>
              {node && (
                <Field form={form} name="status" label="Status" required className="col-md-6">
                  <Select className="form-select form-select-sm" value={values.status} onChange={e => set({ status: e.target.value })}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </Select>
                </Field>
              )}
            </FormSection>
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top d-block">
            <FormSubmit form={form} label={node ? 'Save changes' : 'Add'} loadingLabel="Saving..." busy={saving} onSubmit={save} onCancel={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};
