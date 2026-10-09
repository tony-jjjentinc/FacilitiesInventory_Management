import React from 'react';
import type { ReceivingLine, StorageNode } from '../../types';
import { PriceCell } from './PriceCell';
import { StepCard } from './StepCard';
import { nodeLabel, spotPath } from './receivingUtils';

interface Props {
  mode: 'MRL' | 'MANUAL';
  title: string;
  hint?: string;
  lines: ReceivingLine[];
  onChange: (lines: ReceivingLine[]) => void;
  /** Storage spots inside the chosen area (warehouse destination only). */
  spotOptions: StorageNode[];
  allStorage: StorageNode[];
}

export const ReceivingLinesSection: React.FC<Props> = ({ mode, title, hint, lines, onChange, spotOptions, allStorage }) => {
  const update = (key: string, patch: Partial<ReceivingLine>) =>
    onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const toggleStatus = (l: ReceivingLine) =>
    update(l.key, l.lineStatus === 'VERIFIED'
      ? { lineStatus: 'REJECTED', mismatchDetails: l.mismatchDetails || 'Specification mismatch at dock' }
      : { lineStatus: 'VERIFIED', mismatchDetails: '' });

  const unpriced = lines.filter(l => l.lineStatus === 'VERIFIED' && (l.unitCost.trim() === '' || Number(l.unitCost) === 0)).length;
  const cols = (mode === 'MRL' ? 8 : 6) + (spotOptions.length > 0 ? 1 : 0);

  return (
    <StepCard title={title} hint={hint} flush>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
          <thead className="table-light">
            <tr>
              {mode === 'MRL' && <th>Status</th>}
              <th>Item Information</th>
              {mode === 'MRL' && <th className="text-end">Requested</th>}
              {mode === 'MRL' && <th className="text-end">Released</th>}
              <th style={{ width: '110px' }}>Received</th>
              <th>UOM</th>
              <th>Unit Cost</th>
              <th>Serial</th>
              {spotOptions.length > 0 && <th>Storage Spot</th>}
              {mode === 'MANUAL' && <th></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={cols + 1} className="text-center text-muted py-4">No items yet.</td></tr>
            )}
            {lines.map(l => {
              const invalid = l.lineStatus === 'REJECTED';
              const dash = <span className="text-muted">—</span>;
              return (
                <React.Fragment key={l.key}>
                  <tr className={invalid ? 'table-danger-subtle' : ''}>
                    {mode === 'MRL' && (
                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm py-0 px-2 ${invalid ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          style={{ fontSize: '0.75rem', minWidth: '70px' }}
                          title="Click to switch between Receive and Invalid (returned to ProcInv through an MRT)"
                          onClick={() => toggleStatus(l)}
                        >
                          {invalid ? 'Invalid' : 'Receive'}
                        </button>
                      </td>
                    )}
                    <td>
                      <span className="font-monospace fw-semibold text-dark">{l.itemId}</span>
                      <span className="text-muted"> — {l.itemName}</span>
                    </td>
                    {mode === 'MRL' && <td className="text-end">{l.requestedQty ?? '—'}</td>}
                    {mode === 'MRL' && <td className="text-end fw-semibold">{l.releasedQty ?? '—'}</td>}
                    <td>
                      {invalid ? dash : (
                        <input type="number" min="0" step="any" className="form-control form-control-sm" value={l.receivedQty}
                          onChange={e => update(l.key, { receivedQty: e.target.value })} />
                      )}
                    </td>
                    <td>{l.uom}</td>
                    <td>{invalid ? dash : <PriceCell line={l} onChange={next => update(l.key, next)} />}</td>
                    <td>
                      {invalid ? dash : (
                        <input type="text" className="form-control form-control-sm" aria-label="Serial number" title="Leave blank if the item has no serial number" style={{ maxWidth: '110px' }}
                          value={l.serialNumber === 'N/A' ? '' : l.serialNumber}
                          onChange={e => update(l.key, { serialNumber: e.target.value })} />
                      )}
                    </td>
                    {spotOptions.length > 0 && (
                      <td>
                        {invalid ? dash : (
                          <select className="form-select form-select-sm" value={l.storageId} onChange={e => update(l.key, { storageId: e.target.value })}>
                            <option value="">Whole area</option>
                            {spotOptions.map(sp => <option key={sp.storageId} value={sp.storageId}>{spotPath(allStorage, sp.storageId) || nodeLabel(sp)}</option>)}
                          </select>
                        )}
                      </td>
                    )}
                    {mode === 'MANUAL' && (
                      <td className="text-end">
                        <button type="button" className="btn btn-link btn-sm text-danger p-0 text-decoration-none" onClick={() => onChange(lines.filter(x => x.key !== l.key))}>Remove</button>
                      </td>
                    )}
                  </tr>
                  {mode === 'MRL' && !l.mapped && (
                    <tr className={invalid ? 'table-danger-subtle' : 'table-warning'}>
                      <td colSpan={cols + 1} className="small text-danger">This item is not in the catalog. Map it in Configuration, or keep it as Invalid.</td>
                    </tr>
                  )}
                  {mode === 'MRL' && invalid && (
                    <tr className="table-danger-subtle">
                      <td colSpan={cols + 1}>
                        <label className="form-label small mb-1">Why is this item invalid? (shown on the MRT)</label>
                        <input type="text" className="form-control form-control-sm"
                          value={l.mismatchDetails} onChange={e => update(l.key, { mismatchDetails: e.target.value })} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {unpriced > 0 && (
        <div className="px-3 py-2 small text-warning-emphasis border-top bg-warning-subtle">
          {unpriced} item{unpriced > 1 ? 's have' : ' has'} no price. {unpriced > 1 ? 'They are' : 'It is'} received at ₱0, and a project is charged ₱0 for {unpriced > 1 ? 'them' : 'it'} until a Head or Super Admin sets the price.
        </div>
      )}
    </StepCard>
  );
};
