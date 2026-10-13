/**
 * @file WarehouseForm.tsx
 * @description Add or edit a warehouse (Warehouse_Location: code, name, description) without leaving its pages, and the
 * Configurations tab of a warehouse page with Edit and Remove. Head and Super Admin only (the API enforces it).
 * A warehouse that still holds stock or has active areas cannot be removed; the API says why.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { invalidateCache } from '../../services/cache';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../ConfirmModal';
import { Field } from '../form/Field';
import { FormLegend, FormSection } from '../form/FormSection';
import { FormSubmit } from '../form/FormSubmit';
import { useForm, type FormErrors } from '../form/useForm';
import type { EntityProfile } from '../../types';
import { ConfigTab } from './ConfigTab';

interface Existing { id: string; name: string; description: string }
interface ModalProps { warehouse?: Existing; existingIds?: string[]; onClose: () => void; onSaved: (id: string) => void }
interface Values { id: string; name: string; description: string }

export const WarehouseModal: React.FC<ModalProps> = ({ warehouse, existingIds = [], onClose, onSaved }) => {
  const toast = useToast();
  const [values, setValues] = useState<Values>({ id: warehouse?.id || '', name: warehouse?.name || '', description: warehouse?.description || '' });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<Values>) => setValues(v => ({ ...v, ...p }));
  const validate = (v: Values): FormErrors => {
    const e: FormErrors = {};
    if (!warehouse) {
      if (!v.id.trim()) e.id = 'Enter a short code for the warehouse.';
      else if (!/^[A-Za-z0-9_-]+$/.test(v.id.trim())) e.id = 'Use letters, numbers, - and _ only.';
      else if (existingIds.some(x => x.toLowerCase() === v.id.trim().toLowerCase())) e.id = 'A warehouse with this code already exists.';
    }
    if (!v.name.trim()) e.name = 'Enter a name.';
    return e;
  };
  const form = useForm(values, validate);
  const save = async () => {
    setSaving(true);
    try {
      const id = (warehouse?.id || values.id).trim();
      await apiRequest('config:saveRecord', { table: 'Warehouse_Location', idField: 'ID', createOnly: !warehouse, record: { ID: id, Name: values.name.trim(), Description: values.description.trim() } });
      invalidateCache('entity:'); invalidateCache('config:Warehouse_Location'); invalidateCache('receiving:');
      toast.success(warehouse ? 'Saved.' : 'Warehouse added.');
      onSaved(id);
    } catch (e: any) { toast.error(e.message || 'Could not save.'); form.touchAll(); } finally { setSaving(false); }
  };
  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <h6 className="modal-title fw-bold mb-0">{warehouse ? 'Edit warehouse' : 'Add warehouse'}</h6>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>
          <div className="modal-body p-4">
            <FormLegend />
            <FormSection>
              <Field form={form} name="id" label="Code" required className="col-12" hint={warehouse ? 'The code cannot be changed.' : 'For example FACILITIES_WAREHOUSE_ANNEX. It cannot be changed later.'}>
                <input className="form-control form-control-sm font-monospace" value={values.id} disabled={!!warehouse} onChange={e => set({ id: e.target.value })} />
              </Field>
              <Field form={form} name="name" label="Name" required className="col-12"><input className="form-control form-control-sm" value={values.name} onChange={e => set({ name: e.target.value })} /></Field>
              <Field form={form} name="description" label="Description" className="col-12"><textarea className="form-control form-control-sm" rows={2} value={values.description} onChange={e => set({ description: e.target.value })} /></Field>
            </FormSection>
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top d-block">
            <FormSubmit form={form} label={warehouse ? 'Save changes' : 'Add warehouse'} loadingLabel="Saving..." busy={saving} onSubmit={save} onCancel={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};

/** The Configurations tab of a warehouse page: the record, Edit and Remove. */
export const WarehouseConfigTab: React.FC<{ profile: EntityProfile; reload: () => void }> = ({ profile, reload }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const rec = profile.record || {};
  const remove = async () => {
    setBusy(true);
    try {
      await apiRequest('config:deleteRecord', { table: 'Warehouse_Location', idField: 'ID', id: profile.scopeRef });
      invalidateCache('entity:'); invalidateCache('config:Warehouse_Location'); invalidateCache('receiving:');
      toast.success(`${profile.title} was removed.`);
      navigate('/inventory?tab=warehouses');
    } catch (e: any) { toast.error(e.message || 'Could not remove.'); setRemoving(false); } finally { setBusy(false); }
  };
  return (
    <>
      <ConfigTab profile={profile} onEdit={() => setEditing(true)} extra={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setRemoving(true)}>Remove</button>} />
      {editing && <WarehouseModal warehouse={{ id: profile.scopeRef, name: String(rec['Name'] ?? profile.title), description: String(rec['Description'] ?? '') }} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      <ConfirmModal isOpen={removing} title="Remove warehouse" isDanger isLoading={busy} confirmText="Remove"
        message={`Remove ${profile.title}? This deletes the warehouse record. It is refused while the warehouse holds stock or has active areas.`}
        onConfirm={remove} onCancel={() => setRemoving(false)} />
    </>
  );
};
