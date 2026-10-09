import { DispatchPileSection, EMPTY_PILE_CHOICE, type PileChoice } from '../components/cost/DispatchPileSection';
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import type { ActivityRecord, ActivityInventoryItem } from '../types';
import { DataTable, type Column } from '../components/DataTable';
import { RefreshButton } from '../components/RefreshButton';
import { ActivityCards } from '../components/ActivityCards';

export const ProjectAllocation: React.FC = () => {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const [activityItems, setActivityItems] = useState<ActivityInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isItemsLoading, setIsItemsLoading] = useState<boolean>(false);

  // Modals state
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [isConsumeOpen, setIsConsumeOpen] = useState(false);
  const [isSurplusOpen, setIsSurplusOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Form states
  const [pileChoice, setPileChoice] = useState<PileChoice>(EMPTY_PILE_CHOICE);
  const [dispatchForm, setDispatchForm] = useState({
    itemId: '',
    quantity: '1',
    warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN',
    remarks: ''
  });

  const [consumeForm, setConsumeForm] = useState({
    itemId: '',
    quantity: '1',
    purpose: '',
    workDescription: ''
  });

  const [surplusForm, setSurplusForm] = useState({
    itemId: '',
    quantity: '1',
    warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN',
    remarks: ''
  });

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      await fetchWithSwr<ActivityRecord[]>(
        'activity:getAll',
        () => apiRequest<ActivityRecord[]>('activity:getAll'),
        (data) => {
          if (Array.isArray(data)) {
            setActivities(data);
            if (!selectedActivity && data.length > 0) {
              setSelectedActivity(data[0]);
            }
          }
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error('Failed to load activities:', err);
      setIsLoading(false);
    }
  };

  const fetchActivityItems = async (activityId: string) => {
    setIsItemsLoading(true);
    try {
      await fetchWithSwr<ActivityInventoryItem[]>(
        `activity:items:${activityId}`,
        () => apiRequest<ActivityInventoryItem[]>('activity:getItems', { activityId }),
        (data) => {
          if (Array.isArray(data)) {
            setActivityItems(data);
          }
          setIsItemsLoading(false);
        }
      );
    } catch (err) {
      console.error('Failed to load activity items:', err);
      setIsItemsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    if (selectedActivity) {
      fetchActivityItems(selectedActivity.Activity_ID);
    } else {
      setActivityItems([]);
    }
  }, [selectedActivity]);

  useEffect(() => {
    const isAnyModalOpen = isDispatchOpen || isConsumeOpen || isSurplusOpen;
    if (isAnyModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isDispatchOpen, isConsumeOpen, isSurplusOpen]);

  // Total KPIs
  const totalProjects = activities.length;
  const activeProjects = activities.filter(a => a.Status === 'ACTIVE').length;
  const totalCurrentCost = activities.reduce((sum, a) => sum + (Number(a.Current_Net_Cost) || 0), 0);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    setIsSubmitting(true);
    setModalFeedback(null);
    const qty = Number(dispatchForm.quantity) || 1;
    const selection = pileChoice.customize
      ? Object.entries(pileChoice.picks).filter(([, v]) => Number(v) > 0).map(([layerId, v]) => ({ layerId, quantity: Number(v) }))
      : undefined;
    if (selection) {
      const sum = selection.reduce((t, x) => t + x.quantity, 0);
      if (Math.abs(sum - qty) > 1e-9) { setModalFeedback(`The picked deliveries add up to ${sum}, but the quantity is ${qty}.`); setIsSubmitting(false); return; }
      if (!pileChoice.reason.trim()) { setModalFeedback('Give a reason for picking deliveries.'); setIsSubmitting(false); return; }
    }
    try {
      await apiRequest('inventory:dispatch', {
        activityId: selectedActivity.Activity_ID,
        warehouseLocation: dispatchForm.warehouseLocation,
        areaId: pileChoice.areaId,
        overrideReason: selection ? pileChoice.reason.trim() : '',
        accountablePartyId: selectedActivity.Site_Supervisor_ID,
        remarks: dispatchForm.remarks,
        items: [
          {
            itemId: dispatchForm.itemId.trim(),
            quantity: qty,
            ...(selection ? { pileSelection: selection } : {})
          }
        ]
      });
      invalidateCache('activity');
      invalidateCache(`activity:items:${selectedActivity.Activity_ID}`);
      invalidateCache('inventory:stock');
      invalidateCache('transaction:history');
      await fetchActivities();
      await fetchActivityItems(selectedActivity.Activity_ID);
      setIsDispatchOpen(false);
      setDispatchForm({ itemId: '', quantity: '1', warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN', remarks: '' });
      setPileChoice(EMPTY_PILE_CHOICE);
    } catch (err: any) {
      setModalFeedback(err.message || 'Dispatch failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConsume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    setIsSubmitting(true);
    setModalFeedback(null);
    try {
      await apiRequest('inventory:logConsumption', {
        activityId: selectedActivity.Activity_ID,
        itemId: consumeForm.itemId.trim(),
        quantityExpended: Number(consumeForm.quantity) || 1,
        purpose: consumeForm.purpose.trim() || 'Project Field Installation',
        workDescription: consumeForm.workDescription.trim() || `Installed on ${selectedActivity.Activity_ID}`,
        accountablePartyId: selectedActivity.Site_Supervisor_ID
      });
      invalidateCache('activity');
      invalidateCache(`activity:items:${selectedActivity.Activity_ID}`);
      invalidateCache(`consumption:list:${selectedActivity.Activity_ID}`);
      invalidateCache('consumption:list');
      invalidateCache('transaction:history');
      await fetchActivities();
      await fetchActivityItems(selectedActivity.Activity_ID);
      setIsConsumeOpen(false);
      setConsumeForm({ itemId: '', quantity: '1', purpose: '', workDescription: '' });
    } catch (err: any) {
      setModalFeedback(err.message || 'Consumption logging failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSurplusReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    setIsSubmitting(true);
    setModalFeedback(null);
    try {
      await apiRequest('inventory:returnSurplus', {
        activityId: selectedActivity.Activity_ID,
        warehouseLocation: surplusForm.warehouseLocation,
        remarks: surplusForm.remarks,
        items: [
          {
            itemId: surplusForm.itemId.trim(),
            quantity: Number(surplusForm.quantity) || 1
          }
        ]
      });
      invalidateCache('activity');
      invalidateCache(`activity:items:${selectedActivity.Activity_ID}`);
      invalidateCache('inventory:stock');
      invalidateCache('transaction:history');
      await fetchActivities();
      await fetchActivityItems(selectedActivity.Activity_ID);
      setIsSurplusOpen(false);
      setSurplusForm({ itemId: '', quantity: '1', warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN', remarks: '' });
    } catch (err: any) {
      setModalFeedback(err.message || 'Surplus return failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const itemColumns: Column<ActivityInventoryItem>[] = [
    {
      key: 'Item_ID',
      label: 'Item ID / SKU',
      minWidth: '140px',
      render: (row) => (
        <div>
          <span className="font-monospace fw-semibold text-primary">{row.Item_ID}</span>
          <div className="small text-secondary">{row.Item_SKU}</div>
        </div>
      )
    },
    {
      key: 'Item_Name',
      label: 'Material Name',
      minWidth: '200px',
      render: (row) => (
        <div>
          <div className="fw-medium text-dark">{row.Item_Name}</div>
          {row.Serial_Number && row.Serial_Number !== 'N/A' && (
            <small className="text-secondary font-monospace">SN: {row.Serial_Number}</small>
          )}
        </div>
      )
    },
    {
      key: 'Qty_Issued',
      label: 'Issued',
      align: 'right',
      minWidth: '80px',
      render: (row) => `${row.Qty_Issued} ${row.UOM}`
    },
    {
      key: 'Qty_Returned',
      label: 'Returned',
      align: 'right',
      minWidth: '80px',
      render: (row) => `${row.Qty_Returned} ${row.UOM}`
    },
    {
      key: 'Net_Used',
      label: 'Net Used',
      align: 'right',
      minWidth: '90px',
      render: (row) => <span className="fw-bold">{row.Net_Used} {row.UOM}</span>
    },
    {
      key: 'Qty_Expended',
      label: 'Expended',
      align: 'right',
      minWidth: '90px',
      render: (row) => <span className="text-success fw-bold">{row.Qty_Expended} {row.UOM}</span>
    },
    {
      key: 'Activity_Line_ID',
      label: 'Remaining On-Site',
      align: 'right',
      minWidth: '120px',
      render: (row) => {
        const remaining = (Number(row.Net_Used) || 0) - (Number(row.Qty_Expended) || 0);
        return <span className={`badge ${remaining > 0 ? 'bg-warning text-dark' : 'bg-secondary'}`}>{remaining} {row.UOM}</span>;
      }
    },
    {
      key: 'Unit_Cost',
      label: 'Billed Cost',
      align: 'right',
      minWidth: '110px',
      render: (row) => Number(row.Unit_Cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      key: 'Item_Tracking_State',
      label: 'Tracking State',
      align: 'center',
      minWidth: '120px',
      render: (row) => {
        const state = row.Item_Tracking_State?.toUpperCase();
        let badge = 'bg-secondary';
        if (state === 'CONSUMED') badge = 'bg-success';
        if (state === 'DEPLOYED') badge = 'bg-primary';
        if (state === 'PARTIAL_USED') badge = 'bg-info text-dark';
        if (state === 'PARTIALLY_RETURNED') badge = 'bg-warning text-dark';
        return <span className={`badge ${badge}`}>{row.Item_Tracking_State}</span>;
      }
    }
  ];


  return (
    <div className="container py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bold text-dark mb-1">Project Allocation & Material Consumption</h4>
          <p className="text-secondary small mb-0">
            Dispatch inventory to active activities, log on-site field usage, and return surplus stock to warehouse.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            disabled={!selectedActivity}
            onClick={() => setIsDispatchOpen(true)}
          >
            <span>Dispatch Stock</span>
          </button>
          <button
            className="btn btn-secondary btn-sm d-flex align-items-center gap-1"
            disabled={!selectedActivity}
            onClick={() => setIsConsumeOpen(true)}
          >
            <span>Log Consumption</span>
          </button>
          <button
            className="btn btn-secondary btn-sm d-flex align-items-center gap-1"
            disabled={!selectedActivity}
            onClick={() => setIsSurplusOpen(true)}
          >
            <span>Return Surplus</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <span className="text-secondary small fw-medium">Total Work Orders</span>
              <h3 className="fw-bold text-dark mt-1 mb-0">{totalProjects}</h3>
              <small className="text-muted">{activeProjects} Active Projects</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <span className="text-secondary small fw-medium">Cumulative Net Cost</span>
              <h3 className="fw-bold text-primary mt-1 mb-0">
                ₱{totalCurrentCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <small className="text-muted">Net Dispatched Materials</small>
            </div>
          </div>
        </div>
      </div>

      {/* Activities */}
      <ActivityCards activities={activities} selectedId={selectedActivity?.Activity_ID} onSelect={setSelectedActivity} loading={isLoading} />

      {/* Selected Activity Material Ledger */}
      {selectedActivity && (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-3 border-0 d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary">{selectedActivity.Activity_ID}</span>
                <h6 className="fw-bold text-dark mb-0">{selectedActivity.Activity_Name}</h6>
              </div>
              <small className="text-secondary">
                Location: {selectedActivity.Site_Location} | Supervisor: {selectedActivity.Site_Supervisor_ID} | Billed Cost: ₱{Number(selectedActivity.Current_Net_Cost || 0).toLocaleString()}
              </small>
            </div>
            <RefreshButton onClick={() => fetchActivityItems(selectedActivity.Activity_ID)} loading={isItemsLoading} />
          </div>
          <div className="card-body p-0">
            <DataTable
              data={activityItems}
              columns={itemColumns}
              keyField="Activity_Line_ID"
              isLoading={isItemsLoading}
              emptyMessage="No materials dispatched to this activity yet."
            />
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {isDispatchOpen && selectedActivity && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <form onSubmit={handleDispatch}>
                <div className="modal-header">
                  <h6 className="modal-title fw-bold">Dispatch Stock (OUT:RELEASE)</h6>
                  <button type="button" className="btn-close" disabled={isSubmitting} onClick={() => setIsDispatchOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="small text-secondary mb-3">
                    Issuing materials from warehouse to <strong>{selectedActivity.Activity_ID}</strong> ({selectedActivity.Activity_Name}).
                  </p>
                  {modalFeedback && <div className="alert alert-danger small py-2">{modalFeedback}</div>}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Item ID *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm font-monospace"
                      placeholder="e.g. ITM-0001"
                      required
                      value={dispatchForm.itemId}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, itemId: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm"
                        required
                        value={dispatchForm.quantity}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, quantity: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Warehouse Location</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={dispatchForm.warehouseLocation}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, warehouseLocation: e.target.value })}
                    />
                  </div>
                  <DispatchPileSection
                    itemId={dispatchForm.itemId}
                    location={dispatchForm.warehouseLocation}
                    quantity={Number(dispatchForm.quantity) || 0}
                    value={pileChoice}
                    onChange={setPileChoice}
                  />
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Remarks</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Optional notes or dispatch batch reference"
                      value={dispatchForm.remarks}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={isSubmitting} onClick={() => setIsDispatchOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Log Consumption Modal */}
      {isConsumeOpen && selectedActivity && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleConsume}>
                <div className="modal-header">
                  <h6 className="modal-title fw-bold">Log Field Material Usage</h6>
                  <button type="button" className="btn-close" disabled={isSubmitting} onClick={() => setIsConsumeOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="small text-secondary mb-3">
                    Record materials physically installed or consumed on-site for <strong>{selectedActivity.Activity_ID}</strong>.
                  </p>
                  {modalFeedback && <div className="alert alert-danger small py-2">{modalFeedback}</div>}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Material Item *</label>
                    <select
                      className="form-select form-select-sm"
                      required
                      value={consumeForm.itemId}
                      onChange={(e) => setConsumeForm({ ...consumeForm, itemId: e.target.value })}
                    >
                      <option value="">-- Select Allocated Item --</option>
                      {activityItems.map(itm => (
                        <option key={itm.Item_ID} value={itm.Item_ID}>
                          {itm.Item_ID} - {itm.Item_Name} (Available: {(Number(itm.Net_Used) || 0) - (Number(itm.Qty_Expended) || 0)} {itm.UOM})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Quantity Expended *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control-sm"
                      required
                      value={consumeForm.quantity}
                      onChange={(e) => setConsumeForm({ ...consumeForm, quantity: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Purpose / Task Milestone *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Chilled Water Feed Loop Installation"
                      required
                      value={consumeForm.purpose}
                      onChange={(e) => setConsumeForm({ ...consumeForm, purpose: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Installation / Work Description</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="e.g. Installed 4 units of PPR piping across 4th floor plant room feed line"
                      value={consumeForm.workDescription}
                      onChange={(e) => setConsumeForm({ ...consumeForm, workDescription: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={isSubmitting} onClick={() => setIsConsumeOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-success" disabled={isSubmitting}>
                    {isSubmitting ? 'Logging...' : 'Record Consumption'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Return Surplus Modal */}
      {isSurplusOpen && selectedActivity && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleSurplusReturn}>
                <div className="modal-header">
                  <h6 className="modal-title fw-bold">Return Surplus to Warehouse (IN:EXCESS)</h6>
                  <button type="button" className="btn-close" disabled={isSubmitting} onClick={() => setIsSurplusOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="small text-secondary mb-3">
                    Return unused stock from site <strong>{selectedActivity.Activity_ID}</strong> back to warehouse balance.
                  </p>
                  {modalFeedback && <div className="alert alert-danger small py-2">{modalFeedback}</div>}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Material Item *</label>
                    <select
                      className="form-select form-select-sm"
                      required
                      value={surplusForm.itemId}
                      onChange={(e) => setSurplusForm({ ...surplusForm, itemId: e.target.value })}
                    >
                      <option value="">-- Select Allocated Item --</option>
                      {activityItems.map(itm => (
                        <option key={itm.Item_ID} value={itm.Item_ID}>
                          {itm.Item_ID} - {itm.Item_Name} (Net Active: {itm.Net_Used} {itm.UOM})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Quantity Returned *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control-sm"
                      required
                      value={surplusForm.quantity}
                      onChange={(e) => setSurplusForm({ ...surplusForm, quantity: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Destination Warehouse</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={surplusForm.warehouseLocation}
                      onChange={(e) => setSurplusForm({ ...surplusForm, warehouseLocation: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Remarks</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Surplus return notes"
                      value={surplusForm.remarks}
                      onChange={(e) => setSurplusForm({ ...surplusForm, remarks: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={isSubmitting} onClick={() => setIsSurplusOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-warning" disabled={isSubmitting}>
                    {isSubmitting ? 'Returning...' : 'Confirm Surplus Return'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
