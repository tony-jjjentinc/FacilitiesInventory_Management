import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import type { ItemTrace, ItemTraceHolder } from '../types';

interface Props {
  itemId: string;
  serialNumber?: string;
  onClose: () => void;
}

const day = (v: string) => (v ? v.slice(0, 16) : '—');

const holderRow = (h: ItemTraceHolder, key: string) => {
  const w = h.where;
  const place = w.locationType === 'WAREHOUSE' ? [w.warehouseLocation, w.areaId].filter(Boolean).join(' · ')
    : w.locationType === 'CUSTODY' ? [w.warehouseLocation, w.areaId, w.siteNote].filter(Boolean).join(' · ') || '—'
      : [w.activityName || w.activityId, w.siteLocation].filter(Boolean).join(' · ');
  const who = h.who.custodianName || h.who.custodianId || h.who.subDepartment || '—';
  return (
    <tr key={key}>
      <td><span className="badge bg-light text-dark border">{w.locationType}</span></td>
      <td>{who}{h.who.subDepartment && who !== h.who.subDepartment ? <div className="small text-muted">{h.who.subDepartment}</div> : null}</td>
      <td>{place}</td>
      <td>{day(h.when.arrivedAt)}</td>
      <td>{day(h.when.lastUsedAt)}</td>
      <td className="text-end">{h.quantity} {h.uom}</td>
    </tr>
  );
};

/** One item: who holds it, where it is, since when, and its recent ledger lines. */
export const ItemTraceModal: React.FC<Props> = ({ itemId, serialNumber, onClose }) => {
  const [trace, setTrace] = useState<ItemTrace | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<ItemTrace>('inventory:getItemTrace', { itemId, serialNumber: serialNumber && serialNumber !== 'N/A' ? serialNumber : '' })
      .then(setTrace)
      .catch(err => setError(err.message || 'Could not load the trace.'));
  }, [itemId, serialNumber]);

  const holders = trace ? [
    ...trace.holders.warehouse.map((h, i) => holderRow(h, `w${i}`)),
    ...trace.holders.custody.map((h, i) => holderRow(h, `c${i}`)),
    ...trace.holders.activities.map((h, i) => holderRow(h, `a${i}`))
  ] : [];

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1060 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border shadow-sm">
          <div className="modal-header py-3 px-4 bg-light border-bottom">
            <div>
              <h6 className="modal-title fw-bold mb-0">Item trace</h6>
              <div className="small text-muted">{trace ? `${trace.item.name} (${trace.item.sku})` : itemId}</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-0">
            {error && <div className="alert alert-danger py-2 small m-3">{error}</div>}
            {!trace && !error && (
              <div className="d-flex align-items-center gap-2 small text-secondary p-3" role="status">
                <span className="spinner-border spinner-border-sm text-primary"></span> Loading…
              </div>
            )}
            {trace && (
              <>
                <div className="px-3 pt-3 fw-semibold small text-uppercase text-muted">Held now</div>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-light"><tr><th>Where</th><th>Who</th><th>Place</th><th>Arrived</th><th>Last used</th><th className="text-end">Quantity</th></tr></thead>
                    <tbody>
                      {holders.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">Nothing on hand.</td></tr>}
                      {holders}
                    </tbody>
                  </table>
                </div>

                <div className="px-3 pt-4 fw-semibold small text-uppercase text-muted">Recent movements</div>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-light"><tr><th>When</th><th>Type</th><th>From</th><th>To</th><th>Who</th><th className="text-end">Quantity</th></tr></thead>
                    <tbody>
                      {trace.events.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">No movements yet.</td></tr>}
                      {trace.events.map((e, i) => (
                        <tr key={`${e.transactionId}-${i}`}>
                          <td>{day(e.when.at)}</td>
                          <td><span className="font-monospace small">{e.type}</span>{e.status && e.status !== 'POSTED' ? <span className="badge bg-warning-subtle text-warning-emphasis border ms-1">{e.status}</span> : null}</td>
                          <td>{e.where.from || '—'}</td>
                          <td>{[e.where.to, e.where.areaId].filter(Boolean).join(' · ') || '—'}</td>
                          <td>{e.who.accountablePartyId || e.who.loggedById || '—'}{e.who.subDepartment ? <div className="small text-muted">{e.who.subDepartment}</div> : null}</td>
                          <td className="text-end">{e.quantity} {e.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer py-2 px-4 bg-light border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};
