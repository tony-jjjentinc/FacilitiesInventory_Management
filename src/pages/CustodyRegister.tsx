import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import type { InHouseCustodyItem } from '../types';
import { DataTable, type Column } from '../components/DataTable';

export const CustodyRegister: React.FC = () => {
  const [custodyItems, setCustodyItems] = useState<InHouseCustodyItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isRetrieveOpen, setIsRetrieveOpen] = useState(false);
  const [selectedCustody, setSelectedCustody] = useState<InHouseCustodyItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Deploy Form
  const [deployForm, setDeployForm] = useState({
    custodianId: '',
    custodianName: '',
    itemId: '',
    serialNumber: '',
    quantity: '1',
    warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN',
    remarks: ''
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    targetCustodianId: '',
    remarks: ''
  });

  // Retrieve Form
  const [retrieveForm, setRetrieveForm] = useState({
    warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN',
    remarks: ''
  });

  const fetchCustody = async () => {
    setIsLoading(true);
    try {
      await fetchWithSwr<InHouseCustodyItem[]>(
        `custody:list:${statusFilter}`,
        () => apiRequest<InHouseCustodyItem[]>('custody:getList', { status: statusFilter }),
        (data) => {
          if (Array.isArray(data)) {
            setCustodyItems(data);
          }
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error('Failed to load custody list:', err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustody();
  }, [statusFilter]);

  useEffect(() => {
    if (isDeployOpen || isTransferOpen || isRetrieveOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isDeployOpen, isTransferOpen, isRetrieveOpen]);

  const activeCount = custodyItems.filter(c => c.Status === 'ACTIVE').length;
  const returnedCount = custodyItems.filter(c => c.Status === 'RETURNED').length;
  const lostCount = custodyItems.filter(c => c.Status === 'LOST').length;

  const filteredItems = custodyItems.filter(item => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.Custody_ID?.toLowerCase().includes(q) ||
      item.Custodian_Name?.toLowerCase().includes(q) ||
      item.Custodian_ID?.toLowerCase().includes(q) ||
      item.Item_Name?.toLowerCase().includes(q) ||
      item.Item_SKU?.toLowerCase().includes(q) ||
      item.Serial_Number?.toLowerCase().includes(q)
    );
  });

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedbackError(null);
    try {
      await apiRequest('inventory:deployTool', {
        custodianId: deployForm.custodianId.trim(),
        custodianName: deployForm.custodianName.trim(),
        warehouseLocation: deployForm.warehouseLocation,
        remarks: deployForm.remarks,
        items: [
          {
            itemId: deployForm.itemId.trim(),
            serialNumber: deployForm.serialNumber.trim() || 'N/A',
            quantity: Number(deployForm.quantity) || 1
          }
        ]
      });
      invalidateCache('custody:list');
      invalidateCache('inventory:stock');
      invalidateCache('transaction:history');
      await fetchCustody();
      setIsDeployOpen(false);
      setDeployForm({
        custodianId: '',
        custodianName: '',
        itemId: '',
        serialNumber: '',
        quantity: '1',
        warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN',
        remarks: ''
      });
    } catch (err: any) {
      setFeedbackError(err.message || 'Tool deployment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustody) return;
    setIsSubmitting(true);
    setFeedbackError(null);
    try {
      await apiRequest('custody:transfer', {
        sourceCustodianId: selectedCustody.Custodian_ID,
        targetCustodianId: transferForm.targetCustodianId.trim(),
        remarks: transferForm.remarks,
        items: [
          {
            itemId: selectedCustody.Item_ID,
            serialNumber: selectedCustody.Serial_Number,
            quantity: selectedCustody.Quantity
          }
        ]
      });
      invalidateCache('custody:list');
      invalidateCache('transaction:history');
      await fetchCustody();
      setIsTransferOpen(false);
      setSelectedCustody(null);
      setTransferForm({ targetCustodianId: '', remarks: '' });
    } catch (err: any) {
      setFeedbackError(err.message || 'Custody transfer failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetrieve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustody) return;
    setIsSubmitting(true);
    setFeedbackError(null);
    try {
      await apiRequest('custody:retrieve', {
        custodyId: selectedCustody.Custody_ID,
        warehouseLocation: retrieveForm.warehouseLocation,
        remarks: retrieveForm.remarks
      });
      invalidateCache('custody:list');
      invalidateCache('inventory:stock');
      invalidateCache('transaction:history');
      await fetchCustody();
      setIsRetrieveOpen(false);
      setSelectedCustody(null);
      setRetrieveForm({ warehouseLocation: 'FACILITIES_WAREHOUSE_MAIN', remarks: '' });
    } catch (err: any) {
      setFeedbackError(err.message || 'Tool retrieval failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<InHouseCustodyItem>[] = [
    {
      key: 'Custody_ID',
      label: 'Custody ID',
      sortable: true,
      minWidth: '130px',
      render: (row) => <span className="font-monospace fw-semibold text-primary">{row.Custody_ID}</span>
    },
    {
      key: 'Custodian_Name',
      label: 'Staff Custodian',
      sortable: true,
      minWidth: '180px',
      render: (row) => (
        <div>
          <div className="fw-medium text-dark">{row.Custodian_Name}</div>
          <small className="text-secondary">{row.Custodian_ID}</small>
        </div>
      )
    },
    {
      key: 'Item_Name',
      label: 'Assigned Tool / Equipment',
      sortable: true,
      minWidth: '220px',
      render: (row) => (
        <div>
          <div className="fw-medium text-dark">{row.Item_Name}</div>
          <div className="small text-secondary">{row.Item_SKU}</div>
        </div>
      )
    },
    {
      key: 'Serial_Number',
      label: 'Serial Number',
      minWidth: '160px',
      render: (row) => (
        <span className="font-monospace small badge bg-light text-dark border">
          {row.Serial_Number || 'N/A'}
        </span>
      )
    },
    {
      key: 'Quantity',
      label: 'Qty',
      align: 'right',
      minWidth: '80px',
      render: (row) => `${row.Quantity} ${row.UOM}`
    },
    {
      key: 'Date_Assigned',
      label: 'Date Assigned',
      sortable: true,
      minWidth: '120px',
      render: (row) => row.Date_Assigned || 'N/A'
    },
    {
      key: 'Unit_Cost',
      label: 'Unit Cost',
      align: 'right',
      minWidth: '110px',
      render: (row) => (Number(row.Unit_Cost) > 0 ? `₱${Number(row.Unit_Cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : <span className="badge bg-warning text-dark">no price</span>)
    },
    {
      key: 'Status',
      label: 'Status',
      sortable: true,
      align: 'center',
      minWidth: '100px',
      render: (row) => {
        const s = row.Status?.toUpperCase();
        let badge = 'bg-secondary';
        if (s === 'ACTIVE') badge = 'bg-success';
        if (s === 'RETURNED') badge = 'bg-info text-dark';
        if (s === 'LOST') badge = 'bg-danger';
        return <span className={`badge ${badge}`}>{row.Status}</span>;
      }
    },
    {
      key: 'Custody_ID',
      label: 'Actions',
      align: 'right',
      minWidth: '160px',
      render: (row) => {
        if (row.Status !== 'ACTIVE') {
          return <span className="small text-muted">{row.Status}</span>;
        }
        return (
          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-outline-primary"
              onClick={() => {
                setSelectedCustody(row);
                setIsTransferOpen(true);
              }}
              title="Transfer to another staff member"
            >
              Transfer
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                setSelectedCustody(row);
                setIsRetrieveOpen(true);
              }}
              title="Surrender back to warehouse"
            >
              Surrender
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="container py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bold text-dark mb-1">In-House Tool & Equipment Custody Register</h4>
          <p className="text-secondary small mb-0">
            Track toolkits assigned to technicians, execute peer-to-peer handovers (TRANSFER:IN_HOUSE), and process returns (IN:RETRIEVE).
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => setIsDeployOpen(true)}
        >
          <i className="bi bi-person-badge"></i>
          <span>Deploy Tool (OUT:DEPLOY)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <span className="text-secondary small fw-medium">Active In-House Toolkits</span>
              <h3 className="fw-bold text-success mt-1 mb-0">{activeCount}</h3>
              <small className="text-muted">Tools currently with field technicians</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <span className="text-secondary small fw-medium">Surrendered / Returned</span>
              <h3 className="fw-bold text-dark mt-1 mb-0">{returnedCount}</h3>
              <small className="text-muted">Tools checked back into warehouse</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <span className="text-secondary small fw-medium">Reported Lost / Missing</span>
              <h3 className="fw-bold text-danger mt-1 mb-0">{lostCount}</h3>
              <small className="text-muted">Items written off via loss incidents</small>
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-white py-3 border-0 d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="RETURNED">Returned Only</option>
              <option value="LOST">Lost Only</option>
            </select>
            <span className="text-secondary small">({filteredItems.length} records)</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search serial, technician, tool..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: '280px' }}
            />
          </div>
        </div>
        <div className="card-body p-0">
          <DataTable
            data={filteredItems}
            columns={columns}
            keyField="Custody_ID"
            isLoading={isLoading}
            emptyMessage="No tool custody records found matching filters."
          />
        </div>
      </div>

      {/* Deploy Tool Modal */}
      {isDeployOpen && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleDeploy}>
                <div className="modal-header">
                  <h6 className="modal-title fw-bold">Deploy Tool / Asset (OUT:DEPLOY)</h6>
                  <button type="button" className="btn-close" disabled={isSubmitting} onClick={() => setIsDeployOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="small text-secondary mb-3">
                    Assign serialized tools or long-term gear to field staff. Deducts warehouse on-hand stock and creates active custody record.
                  </p>
                  {feedbackError && <div className="alert alert-danger small py-2">{feedbackError}</div>}
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Custodian Email / ID *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="technician@jjjentinc.com"
                        required
                        value={deployForm.custodianId}
                        onChange={(e) => setDeployForm({ ...deployForm, custodianId: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Custodian Full Name *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Mark Santos"
                        required
                        value={deployForm.custodianName}
                        onChange={(e) => setDeployForm({ ...deployForm, custodianName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Item ID *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="e.g. ITM-0004"
                        required
                        value={deployForm.itemId}
                        onChange={(e) => setDeployForm({ ...deployForm, itemId: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Serial Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="e.g. SN-DEW-2024-0089"
                        value={deployForm.serialNumber}
                        onChange={(e) => setDeployForm({ ...deployForm, serialNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm"
                        value={deployForm.quantity}
                        onChange={(e) => setDeployForm({ ...deployForm, quantity: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Origin Warehouse</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={deployForm.warehouseLocation}
                        onChange={(e) => setDeployForm({ ...deployForm, warehouseLocation: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Remarks / Accessories</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Issued with charger and carrying case"
                      value={deployForm.remarks}
                      onChange={(e) => setDeployForm({ ...deployForm, remarks: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={isSubmitting} onClick={() => setIsDeployOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Deploying...' : 'Confirm Deployment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Custody Modal */}
      {isTransferOpen && selectedCustody && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleTransfer}>
                <div className="modal-header">
                  <h6 className="modal-title fw-bold">Transfer Tool Custody (TRANSFER:IN_HOUSE)</h6>
                  <button type="button" className="btn-close" disabled={isSubmitting} onClick={() => setIsTransferOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="small text-secondary mb-3">
                    Direct on-site handover of <strong>{selectedCustody.Item_Name}</strong> ({selectedCustody.Serial_Number}) without returning to central warehouse.
                  </p>
                  {feedbackError && <div className="alert alert-danger small py-2">{feedbackError}</div>}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Current Custodian</label>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light"
                      disabled
                      value={`${selectedCustody.Custodian_Name} (${selectedCustody.Custodian_ID})`}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">New Custodian ID / Email *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="new.technician@jjjentinc.com"
                      required
                      value={transferForm.targetCustodianId}
                      onChange={(e) => setTransferForm({ ...transferForm, targetCustodianId: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Handover Notes</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Reason for transfer, current equipment physical condition"
                      value={transferForm.remarks}
                      onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={isSubmitting} onClick={() => setIsTransferOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Transferring...' : 'Confirm Handover'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Surrender Tool Modal */}
      {isRetrieveOpen && selectedCustody && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleRetrieve}>
                <div className="modal-header">
                  <h6 className="modal-title fw-bold">Surrender Tool to Warehouse (IN:RETRIEVE)</h6>
                  <button type="button" className="btn-close" disabled={isSubmitting} onClick={() => setIsRetrieveOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="small text-secondary mb-3">
                    Check <strong>{selectedCustody.Item_Name}</strong> ({selectedCustody.Serial_Number}) back into warehouse inventory.
                  </p>
                  {feedbackError && <div className="alert alert-danger small py-2">{feedbackError}</div>}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Destination Warehouse</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={retrieveForm.warehouseLocation}
                      onChange={(e) => setRetrieveForm({ ...retrieveForm, warehouseLocation: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Inspection Remarks</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Tool returned clean and fully functional"
                      value={retrieveForm.remarks}
                      onChange={(e) => setRetrieveForm({ ...retrieveForm, remarks: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={isSubmitting} onClick={() => setIsRetrieveOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Surrendering...' : 'Confirm Return'}
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
