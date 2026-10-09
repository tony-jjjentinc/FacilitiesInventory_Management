import React, { useState } from 'react';
import type { ReceivingLine, StorageNode } from '../../types';
import { PriceCell } from './PriceCell';
import { LineEditModal } from './LineEditModal';
import { ActionMenu } from '../ActionMenu';
import { StepCard } from './StepCard';
import { spotPath } from './receivingUtils';

interface Props {
  mode: 'MRL' | 'MANUAL';
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  /** MRL only: lets the user add an uncatalogued line to the inventory item catalog */
  onAddToCatalog?: (line: ReceivingLine) => void;
  /** MRL only: units of measure offered by Update unit */
  uoms?: string[];
  lines: ReceivingLine[];
  onChange: (lines: ReceivingLine[]) => void;
  /** Storage spots inside the chosen area (warehouse destination only). */
  spotOptions: StorageNode[];
  allStorage: StorageNode[];
}

export const ReceivingLinesSection: React.FC<Props> = ({ mode, title, hint, actions, onAddToCatalog, uoms = [], lines, onChange, spotOptions, allStorage }) => {
  const update = (key: string, patch: Partial<ReceivingLine>) =>
    onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const toggleStatus = (l: ReceivingLine) =>
    update(l.key, l.lineStatus === 'VERIFIED'
      ? { lineStatus: 'REJECTED', mismatchDetails: l.mismatchDetails || 'Inventory spectification mismatch' }
      : { lineStatus: 'VERIFIED', mismatchDetails: '' });

  const [editKey, setEditKey] = useState('');
  const editLine = lines.find(l => l.key === editKey);
  const unpriced = lines.filter(l => l.lineStatus === 'VERIFIED' && (l.unitCost.trim() === '' || Number(l.unitCost) === 0)).length;
  const isMrl = mode === 'MRL';

  // One column definition drives the <colgroup>, the header cells and the body cells, so they cannot drift apart.
  type ColKey = 'status' | 'item' | 'requested' | 'released' | 'received' | 'uom' | 'cost' | 'serial' | 'spot' | 'actions';
  const columns: { key: ColKey; label: string; width?: number; align: 'start' | 'center' | 'end' }[] = [
    ...(isMrl ? [{ key: 'status' as const, label: 'Status', width: 72, align: 'center' as const }] : []),
    { key: 'item', label: 'Item Information', align: 'start' },
    ...(isMrl ? [
      { key: 'requested' as const, label: 'Requested', width: 96, align: 'center' as const },
      { key: 'released' as const, label: 'Released', width: 96, align: 'center' as const }
    ] : []),
    { key: 'received', label: 'Received', width: 120, align: 'start' },
    { key: 'uom', label: 'UOM', width: 84, align: 'start' },
    { key: 'cost', label: 'Unit Cost', width: 180, align: 'start' },
    { key: 'serial', label: 'Serial', width: 140, align: 'start' },
    ...(spotOptions.length > 0 ? [{ key: 'spot' as const, label: 'Storage Spot', width: 200, align: 'start' as const }] : []),
    { key: 'actions', label: 'Actions', width: 80, align: 'center' }
  ];
  const alignClass = { start: 'text-start', center: 'text-center', end: 'text-end' };
  const ITEM_MIN = 220;
  const tableMinWidth = ITEM_MIN + columns.reduce((sum, c) => sum + (c.width || 0), 0);

  return (
    <StepCard title={title} hint={hint} actions={actions} flush>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0 lines-table" style={{ fontSize: '0.85rem', tableLayout: 'fixed', width: '100%', minWidth: `${tableMinWidth}px` }}>
          <colgroup>
            {columns.map(c => <col key={c.key} style={c.width ? { width: `${c.width}px` } : undefined} />)}
          </colgroup>
          <thead className="table-light">
            <tr>
              {columns.map(c => <th key={c.key} className={alignClass[c.align]}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center text-muted py-4">No items yet.</td></tr>
            )}
            {lines.map(l => {
              const invalid = l.lineStatus === 'REJECTED';
              const dash = <span className="text-muted">—</span>;
              const cells: Record<ColKey, React.ReactNode> = {
                status: (
                  <div className="d-flex justify-content-center">
                    <span
                      role="img"
                      tabIndex={0}
                      className={`status-dot ${invalid ? 'invalid' : l.mapped ? 'ok' : 'blocked'}`}
                      style={{ cursor: 'help' }}
                      title={invalid
                        ? `Invalid: returned to ProcInv through an MRT${l.mismatchDetails ? ` (${l.mismatchDetails})` : ''}.`
                        : l.mapped
                          ? 'Will be received.'
                          : 'Not in the catalog yet, so it cannot be received. Add it to the catalog first.'}
                      aria-label={invalid ? 'Invalid' : l.mapped ? 'Receive' : 'Needs a catalog item'}
                    >
                      <i className={`bi ${invalid ? 'bi-x-lg' : l.mapped ? 'bi-check-lg' : 'bi-exclamation-lg'}`}></i>
                    </span>
                  </div>
                ),
                item: (
                  <div className="text-break">
                    <div className="text-dark">{l.itemName}</div>
                    <div className="small text-muted">
                      {l.mapped || l.itemId !== 'UNMAPPED' ? <span className="font-monospace">{l.itemId}</span>
                        : isMrl && onAddToCatalog
                          ? <button type="button" className="btn btn-link btn-sm p-0 align-baseline" style={{ fontSize: 'inherit' }} onClick={() => onAddToCatalog(l)}>Not on catalog, register item</button>
                          : <span title="Ask an admin, head or sub-department to register it, or mark it as not matching.">Not on catalog</span>}
                    </div>
                  </div>
                ),
                requested: l.requestedQty ?? '—',
                released: <span className="fw-semibold">{l.releasedQty ?? '—'}</span>,
                received: invalid ? dash : <span className="fw-semibold">{l.receivedQty || '—'}</span>,
                uom: l.uom,
                cost: invalid ? dash : <PriceCell line={l} />,
                serial: invalid ? dash : (l.serialNumber && l.serialNumber !== 'N/A' ? <span className="font-monospace">{l.serialNumber}</span> : dash),
                spot: invalid ? dash : (l.storageId ? (spotPath(allStorage, l.storageId) || l.storageId) : <span className="text-muted">Whole area</span>),
                actions: (
                  <div className="d-flex justify-content-center">
                    <ActionMenu actions={[
                      { key: 'edit', label: 'Update item', hint: 'Quantity, unit, price, serial number and storage spot', hidden: invalid || !l.mapped, onClick: () => setEditKey(l.key) },
                      { key: 'nomatch', label: 'Does not match', hint: 'Returned to ProcInv on an MRT', danger: true, hidden: !isMrl || invalid, onClick: () => toggleStatus(l) },
                      { key: 'receive', label: 'Receive instead', hidden: !isMrl || !(invalid && l.mapped), onClick: () => toggleStatus(l) },
                      { key: 'remove', label: 'Remove', danger: true, hidden: isMrl, onClick: () => onChange(lines.filter(x => x.key !== l.key)) }
                    ]} />
                  </div>
                )
              };
              return (
                <React.Fragment key={l.key}>
                  <tr className={`line-row ${invalid ? 'table-danger-subtle' : ''}`}>
                    {columns.map(c => <td key={c.key} className={alignClass[c.align]}>{cells[c.key]}</td>)}
                  </tr>
                  {isMrl && invalid && (
                    <tr className="table-danger-subtle">
                      <td colSpan={columns.length}>
                        <div className='p-2 pb-3 border-bottom border-2 border-muted'>
                          <label className="form-label small mb-1">Why is this item invalid?</label>
                        <input type="text" className="form-control form-control-sm"
                          value={l.mismatchDetails} onChange={e => update(l.key, { mismatchDetails: e.target.value })} />
                        </div>
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
        <div className="mt-3 px-3 py-2 small text-warning-emphasis border-top bg-warning-subtle">
          {unpriced} item{unpriced > 1 ? 's have' : ' has'} no price. {unpriced > 1 ? 'They are' : 'It is'} received at ₱0, and a project is charged ₱0 for {unpriced > 1 ? 'them' : 'it'} until a Head or Super Admin sets the price.
        </div>
      )}
      {editLine && <LineEditModal line={editLine} mode={mode} uoms={uoms} spotOptions={spotOptions} allStorage={allStorage} onClose={() => setEditKey('')} onApply={next => { update(editLine.key, next); setEditKey(''); }} />}
    </StepCard>
  );
};
