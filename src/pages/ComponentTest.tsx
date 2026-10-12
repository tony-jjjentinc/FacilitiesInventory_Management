import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { Field } from '../components/form/Field';
import { FormSection, FormLegend } from '../components/form/FormSection';
import { FormSubmit } from '../components/form/FormSubmit';
import { useForm, type FormErrors } from '../components/form/useForm';
import { Select } from '../components/Select';
import { GlobalSearch } from '../components/GlobalSearch';
import type { SearchResult } from '../components/globalSearchSources';
import { useToast } from '../context/ToastContext';

/**
 * Sandbox for trying out shared web components at /test (not linked in the navbar).
 * Add a new card per component; nothing here touches real data.
 */
interface DemoValues { name: string; qty: string; reason: string; email: string; note: string }
const EMPTY_DEMO: DemoValues = { name: '', qty: '', reason: '', email: '', note: '' };
// all problems at once; messages are one short sentence each
const validateDemo = (v: DemoValues): FormErrors => {
  const e: FormErrors = {};
  if (!v.name.trim()) e.name = 'Enter the item name.';
  if (!(Number(v.qty) > 0)) e.qty = 'Quantity must be above 0.';
  if (!v.reason) e.reason = 'Choose a reason.';
  if (v.email.trim() && !/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email address, or leave it empty.';
  return e;
};

export const ComponentTest: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [demo, setDemo] = useState<DemoValues>(EMPTY_DEMO);
  const [demoBusy, setDemoBusy] = useState(false);
  const demoForm = useForm(demo, validateDemo);
  const setD = (patch: Partial<DemoValues>) => setDemo(d => ({ ...d, ...patch }));
  const submitDemo = () => {
    setDemoBusy(true);
    window.setTimeout(() => { setDemoBusy(false); toast.success('Saved (demo).'); setDemo(EMPTY_DEMO); demoForm.reset(); }, 1500);
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [picked, setPicked] = useState<SearchResult[]>([]);
  // button-state demo: idle (selectable) -> confirm -> loading -> done -> reset
  const [btnState, setBtnState] = useState<'idle' | 'confirm' | 'loading' | 'done'>('idle');
  const startDemo = () => { setBtnState('loading'); window.setTimeout(() => setBtnState('done'), 2500); };

  return (
    <div className="container py-4 px-3 px-md-4">
      <h5 className="fw-bold mb-1">Component test</h5>
      <p className="text-muted small mb-4">Sandbox for shared components. Add a card per component.</p>

      {/* Form kit */}
      <div className="card border shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="small fw-semibold mb-3">Form kit: sections, fields, errors, submit</div>
          <div style={{ maxWidth: '640px' }}>
            <FormLegend />
            <FormSection step={1} title="Item" description="Titled section with a step number and a description.">
              <Field form={demoForm} name="name" label="Item name" required className="col-md-8">
                <input className="form-control form-control-sm" value={demo.name} onChange={e => setD({ name: e.target.value })} />
              </Field>
              <Field form={demoForm} name="qty" label="Quantity" required hint="In the item's unit." className="col-md-4">
                <input type="number" min="0" className="form-control form-control-sm" value={demo.qty} onChange={e => setD({ qty: e.target.value })} />
              </Field>
            </FormSection>
            <FormSection title="Details">
              <Field form={demoForm} name="reason" label="Reason" required className="col-md-6">
                <Select className="form-select form-select-sm" value={demo.reason} onChange={e => setD({ reason: e.target.value })}>
                  <option value="PURCHASE">Purchase</option>
                  <option value="RETURN">Return</option>
                </Select>
              </Field>
              <Field form={demoForm} name="email" label="Notify (email)" hint="Optional." className="col-md-6">
                <input className="form-control form-control-sm" value={demo.email} onChange={e => setD({ email: e.target.value })} />
              </Field>
            </FormSection>
            <FormSection>
              <Field form={demoForm} name="note" label="Note" className="col-12">
                <textarea className="form-control form-control-sm" rows={2} value={demo.note} onChange={e => setD({ note: e.target.value })} />
              </Field>
            </FormSection>
            <FormSubmit form={demoForm} label="Save item" loadingLabel="Saving..." busy={demoBusy} onSubmit={submitDemo}
              onCancel={() => { setDemo(EMPTY_DEMO); demoForm.reset(); }} cancelLabel="Reset" />
          </div>
        </div>
      </div>

      {/* General search */}
      <div className="card border shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="small fw-semibold mb-2">General search</div>
          <button type="button" className="btn btn-secondary btn-sm text-start d-flex align-items-center gap-2" style={{ minWidth: '280px' }} onClick={() => setSearchOpen(true)}>
            <i className="bi bi-search" aria-hidden="true"></i><span className="flex-grow-1">Search…</span><kbd className="small">Ctrl K</kbd>
          </button>
          <div className="small text-muted mt-2">
            Selecting a result opens its page (this page is left). Last selected: {picked.length ? picked.map(p => `${p.group}: ${p.title}`).slice(-3).join(' | ') : 'nothing yet'}
          </div>
          <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={r => setPicked(p => [...p, r])} />
        </div>
      </div>

      {/* Loading component */}
      <div className="card border shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="small fw-semibold mb-3">Loading component</div>
          <div className="row g-3">
            <div className="col-md-4">
              <div className="small text-muted mb-1">default, with label</div>
              <div className="border rounded"><Loading /></div>
            </div>
            <div className="col-md-4">
              <div className="small text-muted mb-1">default, no label</div>
              <div className="border rounded"><Loading showLabel={false} /></div>
            </div>
            <div className="col-md-4">
              <div className="small text-muted mb-1">text, custom phrases</div>
              <div className="border rounded p-3 small"><Loading variant="text" phrases={['Syncing from ProcInv...', 'Matching items...']} /></div>
            </div>
            <div className="col-md-6">
              <div className="small text-muted mb-1">default, static label (typewriter off)</div>
              <div className="border rounded"><Loading typewriter={false} /></div>
            </div>
            <div className="col-md-6">
              <div className="small text-muted mb-1">text, fixed label</div>
              <div className="border rounded p-3 small"><Loading variant="text" label="Loading the MRL…" /></div>
            </div>
            <div className="col-12">
              <div className="small text-muted mb-1">button states: selectable, confirmation, loading, done, reset (current: {btnState})</div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                {btnState === 'idle' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setBtnState('confirm')}>Submit receipt</button>}
                {btnState === 'confirm' && (
                  <>
                    <span className="small">Submit this receipt?</span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={startDemo}>Confirm</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBtnState('idle')}>Cancel</button>
                  </>
                )}
                {btnState === 'loading' && <button type="button" className="btn btn-primary btn-sm" disabled><Loading variant="button" label="Submitting..." /></button>}
                {btnState === 'done' && <button type="button" className="btn btn-primary btn-sm" disabled>Submitted</button>}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBtnState('idle')} disabled={btnState === 'idle'}>Reset</button>
              </div>
            </div>
            <div className="col-12">
              <div className="small text-muted mb-1">button (with label, label hidden, secondary)</div>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled><Loading variant="button" /></button>
                <button type="button" className="btn btn-primary btn-sm" disabled><Loading variant="button" showLabel={false} /></button>
                <button type="button" className="btn btn-secondary btn-sm" disabled><Loading variant="button" phrases={['Saving...', 'Submitting...']} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      <div className="card border shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="small fw-semibold mb-2">Toast notifications</div>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => toast.success(`Receipt RCP-2026-0001 submitted. (${Date.now() % 1000})`)}>Success</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => toast.error(`Select the goods receiver before submitting. (${Date.now() % 1000})`)}>Error</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => toast.warning(`3 items have no price and are received at ₱0. (${Date.now() % 1000})`)}>Warning</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => toast.info(`The catalog was refreshed in the background. (${Date.now() % 1000})`)}>Info</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => toast.success(`Item saved. (${Date.now() % 1000})`, { actions: [{ label: 'Undo', onClick: () => toast.info('Undone.') }, { label: 'View', onClick: () => navigate('/inventory?tab=catalog') }] })}>With actions</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { toast.success('Stack test: success'); toast.error('Stack test: error'); toast.warning('Stack test: warning'); toast.info('Stack test: info'); }}>All four</button>
          </div>
        </div>
      </div>
    </div>
  );
};
