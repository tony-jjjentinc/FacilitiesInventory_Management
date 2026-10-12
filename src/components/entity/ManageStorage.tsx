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
import type { EntityScopeType, EntityStorageNode, StorageOptions } from '../../types';
import { entityPath, peso } from './entityPaths';
import { useEntityData } from './useEntity';

type NodeType = EntityStorageNode['storageType'];
// mirrors STORAGE_PARENTS in api/ReceivingService.gs (the API enforces it)
const PARENTS: Record<NodeType, NodeType[]> = { AREA: [], SHELF: ['AREA'], LEVEL: ['SHELF'], CONTAINER: ['AREA', 'SHELF', 'LEVEL'], SPACE: ['AREA'] };
const TYPE_LABEL: Record<NodeType, string> = { AREA: 'Area', SHELF: 'Shelf', LEVEL: 'Level', CONTAINER: 'Container', SPACE: 'Space' };

interface Props {
  scopeType: Extract<EntityScopeType, 'WAREHOUSE' | 'AREA'>;
  scopeRef: string;
  /** the warehouse these records belong to */
  warehouseId: string;
  /** for an area page: the area itself, so shelves and containers can sit directly in it */
  root?: { storageId: string; name: string };
}

interface Values { name: string; type: NodeType; parentId: string; shelfNumber: string; level: string; owner: string; description: string; status: string }

export const ManageStorage: React.FC<Props> = ({ scopeType, scopeRef, warehouseId, root }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<{ nodes: EntityStorageNode[] }>('getStorage', scopeType, scopeRef);
  const admin = isUserHeadOrAdmin(getCurrentUser());
  const toast = useToast();
  const [editing, setEditing] = useState<EntityStorageNode | 'new' | null>(null);
  const [retire, setRetire] = useState<EntityStorageNode | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

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
    { key: 'shelfNumber', label: 'Shelf no.', minWidth: '90px', render: n => n.shelfNumber || 'No Data' },
    { key: 'level', label: 'Level', minWidth: '80px', render: n => n.level || 'No Data' },
    { key: 'status', label: 'Status', align: 'center', minWidth: '90px' },
    ...(admin ? [actionsCol] : [])
  ];

  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  return (
    <>
      <DataCard
        title={scopeType === 'WAREHOUSE' ? 'Manage areas' : 'Manage shelves and containers'}
        description={scopeType === 'WAREHOUSE' ? 'Areas of this warehouse. Stock is counted per area.' : 'Shelves, levels, containers and spaces inside this area. They are labels: stock is counted for the whole area.'}
        columns={hideCosts(columns, getAccess(getCurrentUser()))} data={rows} keyField="storageId" isLoading={loading && !data}
        searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search..."
        onRefresh={reload} refreshing={refreshing}
        actions={admin ? [{ key: 'add', label: scopeType === 'WAREHOUSE' ? 'Add area' : 'Add', icon: 'bi-plus-lg', onClick: () => setEditing('new') }] : []}
        emptyMessage={scopeType === 'WAREHOUSE' ? 'No areas yet.' : 'Nothing here yet.'}
      />
      {editing && (
        <StorageNodeModal
          node={editing === 'new' ? null : editing} scopeType={scopeType} warehouseId={warehouseId} root={root} nodes={nodes}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await afterChange(); }}
        />
      )}
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
  onClose: () => void;
  onSaved: () => void;
}

const StorageNodeModal: React.FC<ModalProps> = ({ node, scopeType, warehouseId, root, nodes, onClose, onSaved }) => {
  const toast = useToast();
  const isArea = scopeType === 'WAREHOUSE';
  const [values, setValues] = useState<Values>({
    name: node?.name || '', type: node?.storageType || (isArea ? 'AREA' : 'SHELF'), parentId: node?.parentStorageId || (isArea ? '' : root?.storageId || ''),
    shelfNumber: node?.shelfNumber || '', level: node?.level || '', owner: node?.ownerSubDepartment || '', description: node?.description || '', status: node?.status || 'ACTIVE'
  });
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
    return e;
  };
  const form = useForm(values, validate);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest('config:saveRecord', { table: 'Warehouse_Storage', idField: 'Storage_ID', record: {
        Storage_ID: node?.storageId || '', Warehouse_Location: warehouseId, Storage_Type: values.type, Parent_Storage_ID: isArea ? '' : values.parentId,
        Name: values.name.trim(), Shelf_Number: values.shelfNumber.trim(), Level: values.level.trim(), Owner_SubDepartment: values.type === 'AREA' ? values.owner : '',
        Description: values.description.trim(), Status: values.status
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
                    {(['SHELF', 'LEVEL', 'CONTAINER', 'SPACE'] as NodeType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
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
