import React, { useState } from 'react';
import { apiRequest } from '../services/api';
import { invalidateCache } from '../services/cache';

interface StagedReceiptItem {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  uom: string;
  unitCost: number;
  serialNumber: string;
  status: 'VERIFIED' | 'REJECTED';
  mismatchDetails?: string;
}

export const WarehouseReceiving: React.FC = () => {
  const [mrlNumber, setMrlNumber] = useState('');
  const [mrqNumber, setMrqNumber] = useState('');
  const [integr8GiNumber, setIntegr8GiNumber] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('FACILITIES_WAREHOUSE_MAIN');
  const [remarks, setRemarks] = useState('');

  // Item Lines
  const [items, setItems] = useState<StagedReceiptItem[]>([
    {
      id: '1',
      itemId: 'ITM-0001',
      itemName: 'PPR Pipe 1/2in x 4m PN20',
      quantity: 10,
      uom: 'pc',
      unitCost: 345.5,
      serialNumber: 'N/A',
      status: 'VERIFIED',
      mismatchDetails: ''
    }
  ]);

  // New item form
  const [newItemId, setNewItemId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newUom, setNewUom] = useState('pc');
  const [newUnitCost, setNewUnitCost] = useState('0');
  const [newSerial, setNewSerial] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemId.trim()) return;

    const newItem: StagedReceiptItem = {
      id: Date.now().toString(),
      itemId: newItemId.trim(),
      itemName: newItemName.trim() || `Item ${newItemId.trim()}`,
      quantity: Number(newQty) || 1,
      uom: newUom.trim() || 'pc',
      unitCost: Number(newUnitCost) || 0,
      serialNumber: newSerial.trim() || 'N/A',
      status: 'VERIFIED',
      mismatchDetails: ''
    };

    setItems([...items, newItem]);
    setNewItemId('');
    setNewItemName('');
    setNewQty('1');
    setNewUnitCost('0');
    setNewSerial('');
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const toggleStatus = (id: string) => {
    setItems(
      items.map(item => {
        if (item.id === id) {
          const nextStatus = item.status === 'VERIFIED' ? 'REJECTED' : 'VERIFIED';
          return {
            ...item,
            status: nextStatus,
            mismatchDetails: nextStatus === 'REJECTED' ? 'Specification mismatch at dock' : ''
          };
        }
        return item;
      })
    );
  };

  const updateMismatchDetails = (id: string, details: string) => {
    setItems(
      items.map(item => (item.id === id ? { ...item, mismatchDetails: details } : item))
    );
  };

  const handleProcessIntake = async () => {
    if (!mrlNumber.trim()) {
      setErrorMsg('MRL Number is required.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('At least one delivery item line is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setResult(null);

    const verifiedItems = items
      .filter(i => i.status === 'VERIFIED')
      .map(i => ({
        itemId: i.itemId,
        quantity: i.quantity,
        unitCost: i.unitCost,
        serialNumber: i.serialNumber,
        uom: i.uom
      }));

    const rejectedItems = items
      .filter(i => i.status === 'REJECTED')
      .map(i => ({
        itemId: i.itemId,
        requestedItemName: i.itemName,
        deliveredItemName: i.itemName,
        quantity: i.quantity,
        uom: i.uom,
        mismatchDetails: i.mismatchDetails || 'Item mismatch at dock'
      }));

    try {
      const response = await apiRequest('inventory:intakeMrl', {
        mrlNumber: mrlNumber.trim(),
        mrqNumber: mrqNumber.trim() || 'N/A',
        integr8GiNumber: integr8GiNumber.trim(),
        warehouseLocation,
        remarks: remarks.trim(),
        verifiedItems,
        rejectedItems
      });

      setResult(response);
      invalidateCache('inventory:stock');
      invalidateCache('transaction:history');
      // Reset form
      setMrlNumber('');
      setMrqNumber('');
      setIntegr8GiNumber('');
      setRemarks('');
      setItems([]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Physical verification and intake failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifiedCount = items.filter(i => i.status === 'VERIFIED').length;
  const rejectedCount = items.filter(i => i.status === 'REJECTED').length;

  return (
    <div className="container px-4 py-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            Physical Receiving & MRL Verification
          </h4>
          <p className="text-muted small mb-0">
            Inspect procurement delivery shipments, intake matching goods into warehouse inventory (IN:MRL), and generate dock return vouchers (MRT).
          </p>
        </div>
      </div>

      {result && (
        <div className="alert alert-success border-success-subtle shadow-sm p-4 mb-4">
          <h5 className="fw-bold text-success d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-check-circle-fill"></i>
            Intake Verification Processed Successfully!
          </h5>
          <div className="row g-2 small mt-2">
            <div className="col-md-3">
              <strong>MRL Number:</strong> <span className="font-monospace">{result.mrlNumber}</span>
            </div>
            {result.transactionId && (
              <div className="col-md-3">
                <strong>Warehouse Transaction:</strong> <span className="font-monospace text-primary">{result.transactionId}</span>
              </div>
            )}
            {result.mrtNumber && (
              <div className="col-md-3">
                <strong>MRT Voucher ID:</strong> <span className="font-monospace text-danger">{result.mrtNumber}</span>
              </div>
            )}
            <div className="col-md-3">
              <strong>Counts:</strong> {result.verifiedCount} Verified, {result.rejectedCount} Rejected
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger py-2 small mb-3">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {errorMsg}
        </div>
      )}

      {/* Main Receiving Form */}
      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-light fw-bold small text-uppercase">
              <i className="bi bi-file-earmark-text me-1 text-primary"></i>
              Shipment Information
            </div>
            <div className="card-body p-3">
              <div className="mb-3">
                <label className="form-label small fw-semibold">Procurement MRL # *</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. MRL-2026-0089"
                  value={mrlNumber}
                  onChange={(e) => setMrlNumber(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Associated MRQ #</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. MRQ-2026-0120"
                  value={mrqNumber}
                  onChange={(e) => setMrqNumber(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Integr8 GI Reference</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Integr8 Goods Issue Number"
                  value={integr8GiNumber}
                  onChange={(e) => setIntegr8GiNumber(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Receiving Warehouse Location *</label>
                <select
                  className="form-select form-select-sm"
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value)}
                >
                  <option value="FACILITIES_WAREHOUSE_MAIN">Facilities Main Warehouse (FACILITIES_WAREHOUSE_MAIN)</option>
                  <option value="WH-NORTH">North Depot Yard (WH-NORTH)</option>
                  <option value="WH-CHILLER-PLANT">Chiller Plant Vault (WH-CHILLER-PLANT)</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Intake Remarks / Notes</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  placeholder="Delivery condition, driver details..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                ></textarea>
              </div>

              <hr />

              <div className="d-grid gap-2">
                <button
                  type="button"
                  className="btn btn-success btn-sm d-flex align-items-center justify-content-center gap-2"
                  onClick={handleProcessIntake}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Processing Verification...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-all"></i>
                      Commit Delivery ({verifiedCount} Verified, {rejectedCount} Rejected)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Line Items Checklist */}
        <div className="col-lg-8">
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <span className="fw-bold small text-uppercase">
                <i className="bi bi-list-check me-1 text-success"></i>
                Inspection Checklist ({items.length} Lines)
              </span>
              <div className="d-flex gap-2">
                <span className="badge bg-success-subtle text-success border">{verifiedCount} Accepted</span>
                <span className="badge bg-danger-subtle text-danger border">{rejectedCount} Dock Rejected</span>
              </div>
            </div>

            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th>Status</th>
                      <th>Item ID & Name</th>
                      <th className="text-end">Qty</th>
                      <th>UOM</th>
                      <th className="text-end">Unit Cost</th>
                      <th>Serial</th>
                      <th>Mismatch / Return Notes</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-4">
                          No delivery lines added. Use the form below to add incoming shipment lines.
                        </td>
                      </tr>
                    ) : (
                      items.map(item => (
                        <tr key={item.id} className={item.status === 'REJECTED' ? 'table-danger-subtle' : ''}>
                          <td>
                            <button
                              type="button"
                              className={`btn btn-sm py-0 px-2 rounded-pill ${
                                item.status === 'VERIFIED'
                                  ? 'btn-success text-white'
                                  : 'btn-danger text-white'
                              }`}
                              style={{ fontSize: '0.7rem' }}
                              onClick={() => toggleStatus(item.id)}
                              title="Click to toggle between Verified and Dock Rejected"
                            >
                              {item.status === 'VERIFIED' ? '✓ Verified' : '✕ Reject (MRT)'}
                            </button>
                          </td>
                          <td>
                            <div className="font-monospace fw-bold text-dark">{item.itemId}</div>
                            <div className="small text-muted">{item.itemName}</div>
                          </td>
                          <td className="text-end fw-bold">{item.quantity}</td>
                          <td>{item.uom}</td>
                          <td className="text-end font-monospace">₱{item.unitCost.toFixed(2)}</td>
                          <td><span className="small text-muted">{item.serialNumber}</span></td>
                          <td>
                            {item.status === 'REJECTED' ? (
                              <input
                                type="text"
                                className="form-control form-control-sm py-0"
                                placeholder="Reason for dock rejection..."
                                value={item.mismatchDetails || ''}
                                onChange={(e) => updateMismatchDetails(item.id, e.target.value)}
                              />
                            ) : (
                              <span className="text-muted small">Matches Spec</span>
                            )}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm py-0 px-1"
                              onClick={() => handleRemoveItem(item.id)}
                              title="Remove item"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Add Item Form */}
          <div className="card shadow-sm border-0">
            <div className="card-header bg-light fw-bold small text-uppercase">
              <i className="bi bi-plus-circle me-1 text-primary"></i>
              Add Delivery Line Item
            </div>
            <div className="card-body p-3">
              <form onSubmit={handleAddItem} className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Item ID *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. ITM-0004"
                    value={newItemId}
                    onChange={(e) => setNewItemId(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Item Name</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. PPR Gate Valve"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-semibold mb-1">Qty *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control form-control-sm"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-1">
                  <label className="form-label small fw-semibold mb-1">UOM</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={newUom}
                    onChange={(e) => setNewUom(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-semibold mb-1">Unit Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={newUnitCost}
                    onChange={(e) => setNewUnitCost(e.target.value)}
                  />
                </div>
                <div className="col-md-1">
                  <button type="submit" className="btn btn-primary btn-sm w-100">
                    <i className="bi bi-plus"></i> Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
