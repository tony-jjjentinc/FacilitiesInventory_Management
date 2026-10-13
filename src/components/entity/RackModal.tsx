/**
 * @file RackModal.tsx
 * @description Creates a rack in one go: a number of shelves, each with a number of levels, inside an area. Shows what will be created first.
 */
import React, { useState } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Field } from '../form/Field';
import { FormLegend, FormSection } from '../form/FormSection';
import { FormSubmit } from '../form/FormSubmit';
import { useForm, type FormErrors } from '../form/useForm';

interface Props { warehouseId: string; area: { storageId: string; name: string }; onClose: () => void; onSaved: () => void }
interface Values { shelves: string; levels: string; startAt: string }

const whole = (v: string) => (v.trim() !== '' && Number.isInteger(Number(v)) ? Number(v) : NaN);

export const RackModal: React.FC<Props> = ({ warehouseId, area, onClose, onSaved }) => {
  const toast = useToast();
  const [values, setValues] = useState<Values>({ shelves: '4', levels: '3', startAt: '1' });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<Values>) => setValues(v => ({ ...v, ...p }));
  const validate = (v: Values): FormErrors => {
    const e: FormErrors = {};
    const s = whole(v.shelves); const l = whole(v.levels); const a = whole(v.startAt);
    if (!(s >= 1 && s <= 50)) e.shelves = 'Enter a whole number from 1 to 50.';
    if (!(l >= 0 && l <= 12)) e.levels = 'Enter a whole number from 0 to 12.';
    if (!(a >= 0 && a <= 9999)) e.startAt = 'Enter a whole number from 0 to 9999.';
    return e;
  };
  const form = useForm(values, validate);
  const s = whole(values.shelves); const l = whole(values.levels); const a = whole(values.startAt);
  const valid = Object.keys(validate(values)).length === 0;

  const save = async () => {
    setSaving(true);
    try {
      const r = await apiRequest<{ created: number; shelves: number }>('storage:createRack', { warehouseLocation: warehouseId, areaId: area.storageId, shelves: s, levels: l, startAt: a });
      toast.success(`Created ${r.shelves} shelves (${r.created} spots).`);
      onSaved();
    } catch (e: any) { toast.error(e.message || 'Could not create the rack.'); form.touchAll(); } finally { setSaving(false); }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <h6 className="modal-title fw-bold mb-0">Add rack to {area.name || area.storageId}</h6>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>
          <div className="modal-body p-4">
            <FormLegend />
            <FormSection>
              <Field form={form} name="shelves" label="Number of shelves" required className="col-md-4"><input className="form-control form-control-sm" inputMode="numeric" value={values.shelves} onChange={e => set({ shelves: e.target.value })} /></Field>
              <Field form={form} name="levels" label="Levels per shelf" required className="col-md-4" hint="0 for none."><input className="form-control form-control-sm" inputMode="numeric" value={values.levels} onChange={e => set({ levels: e.target.value })} /></Field>
              <Field form={form} name="startAt" label="First shelf number" required className="col-md-4"><input className="form-control form-control-sm" inputMode="numeric" value={values.startAt} onChange={e => set({ startAt: e.target.value })} /></Field>
            </FormSection>
            {valid && (
              <div className="alert alert-light border small mt-3 mb-0">
                Creates <strong>{s} shelves</strong> ({`Shelf ${a}`} to {`Shelf ${a + s - 1}`}){l > 0 && <>, each with <strong>{l} level{l === 1 ? '' : 's'}</strong> (Level 1{l > 1 ? ` to Level ${l}` : ''})</>}: <strong>{s + s * l} records</strong> in all. Shelves that already exist in this area are not touched; a clash stops the whole job.
              </div>
            )}
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top d-block">
            <FormSubmit form={form} label="Create rack" loadingLabel="Creating..." busy={saving} onSubmit={save} onCancel={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};
