import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import type { TransactionEntry, TransactionLineItem } from '../types';
import type { Column } from '../components/DataTable';
import { DataCard } from '../components/DataCard';

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'POSTED' | 'VOIDED'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Detail Modal State
  const [selectedTx, setSelectedTx] = useState<TransactionEntry | null>(null);

  // New Staged Transaction Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTxType, setNewTxType] = useState('OUT:RELEASE');
  const [newSourceType, setNewSourceType] = useState('INVENTORY');
  const [newSourceRefId, setNewSourceRefId] = useState('FACILITIES_WAREHOUSE_MAIN');
  const [newDestType, setNewDestType] = useState('ACTIVITY');
  const [newDestRefId, setNewDestRefId] = useState('');
  const [newAccountableParty, setNewAccountableParty] = useState('');
  const [newRemarks, setNewRemarks] = useState('');
  const [newItemId, setNewItemId] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newSerial, setNewSerial] = useState('');
  const [createError, setCreateError] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const fetchTransactions = async () => {
    setIsLoading(true);
    const cacheKey = `transaction:history:${statusFilter}`;
    try {
      await fetchWithSwr<TransactionEntry[]>(
        cacheKey,
        () => apiRequest<TransactionEntry[]>('transaction:getHistory', { status: statusFilter }),
        (data) => {
          if (Array.isArray(data)) {
            setTransactions(data);
          }
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error('Failed to load transaction history:', err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter]);

  useEffect(() => {
    if (isCreateOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isCreateOpen]);

  const handleCommit = async (txId: string) => {
    if (!window.confirm(`Are you sure you want to commit and execute transaction ${txId}? This will mutate warehouse stock.`)) {
      return;
    }
    setProcessingId(txId);
    try {
      await apiRequest('transaction:commit', { transactionId: txId });
      invalidateCache('transaction:history');
      invalidateCache('inventory:stock');
      invalidateCache('custody:list');
      invalidateCache('activity');
      fetchTransactions();
      alert(`Transaction ${txId} successfully committed to POSTED.`);
    } catch (err: any) {
      alert(`Commit failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (txId: string) => {
    const reason = window.prompt(`Please enter cancellation reason for ${txId}:`);
    if (reason === null) return; // User pressed Cancel
    if (!reason.trim()) {
      alert('Cancellation reason is required.');
      return;
    }

    setProcessingId(txId);
    try {
      await apiRequest('transaction:cancel', { transactionId: txId, reason: reason.trim() });
      invalidateCache('transaction:history');
      fetchTransactions();
      alert(`Transaction ${txId} successfully marked as VOIDED.`);
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateStaged = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemId.trim()) {
      setCreateError('Item ID is required.');
      return;
    }
    if (Number(newQty) <= 0) {
      setCreateError('Quantity must be greater than 0.');
      return;
    }

    setIsSubmittingNew(true);
    setCreateError('');
    try {
      await apiRequest('transaction:prepare', {
        transactionType: newTxType,
        sourceType: newSourceType,
        sourceRefId: newSourceRefId.trim(),
        destinationType: newDestType,
        destinationRefId: newDestRefId.trim() || 'N/A',
        accountablePartyId: newAccountableParty.trim(),
        remarks: newRemarks.trim(),
        items: [
          {
            itemId: newItemId.trim(),
            quantity: Number(newQty),
            serialNumber: newSerial.trim() || 'N/A'
          }
        ]
      });

      alert('Staged transaction drafted in PENDING status.');
      setIsCreateOpen(false);
      invalidateCache('transaction:history');
      fetchTransactions();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to prepare transaction');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const pendingCount = transactions.filter(t => t.status === 'PENDING').length;

  const filteredTransactions = transactions.filter(t => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      t.transactionId?.toLowerCase().includes(q) ||
      t.transactionType?.toLowerCase().includes(q) ||
      t.sourceRefId?.toLowerCase().includes(q) ||
      t.destinationRefId?.toLowerCase().includes(q) ||
      t.accountablePartyId?.toLowerCase().includes(q) ||
      t.remarks?.toLowerCase().includes(q)
    );
  });

  const columns: Column<TransactionEntry>[] = [
    {
      key: 'transactionId',
      label: 'Transaction ID',
      align: 'left',
      minWidth: '140px',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          className="btn btn-link p-0 font-monospace fw-bold text-primary text-decoration-none"
          onClick={() => setSelectedTx(row)}
          title="Click to view details and lines"
        >
          {row.transactionId}
        </button>
      )
    },
    {
      key: 'timestamp',
      label: 'Timestamp',
      align: 'left',
      minWidth: '140px',
      sortable: true,
      render: (row) => <span className="small text-muted">{row.timestamp}</span>
    },
    {
      key: 'transactionType',
      label: 'Classification',
      align: 'center',
      minWidth: '140px',
      sortable: true,
      render: (row) => {
        let badgeColor = 'bg-secondary-subtle text-secondary';
        if (row.transactionType.startsWith('IN:')) badgeColor = 'bg-success-subtle text-success';
        if (row.transactionType.startsWith('OUT:')) badgeColor = 'bg-primary-subtle text-primary';
        if (row.transactionType.startsWith('TRANSFER:')) badgeColor = 'bg-info-subtle text-info';
        if (row.transactionType.startsWith('AUDIT:')) badgeColor = 'bg-dark-subtle text-dark';
        return <span className={`badge ${badgeColor} border`}>{row.transactionType}</span>;
      }
    },
    {
      key: 'sourceRefId',
      label: 'Source',
      align: 'left',
      minWidth: '150px',
      render: (row) => (
        <div>
          <span className="small fw-semibold text-dark">{row.sourceRefId}</span>
          <span className="badge bg-light text-muted border ms-1" style={{ fontSize: '0.65rem' }}>{row.sourceType}</span>
        </div>
      )
    },
    {
      key: 'destinationRefId',
      label: 'Destination',
      align: 'left',
      minWidth: '150px',
      render: (row) => (
        <div>
          <span className="small fw-semibold text-dark">{row.destinationRefId || 'N/A'}</span>
          <span className="badge bg-light text-muted border ms-1" style={{ fontSize: '0.65rem' }}>{row.destinationType}</span>
        </div>
      )
    },
    {
      key: 'totalCost',
      label: 'Value (PHP)',
      align: 'right',
      minWidth: '120px',
      sortable: true,
      render: (row) => (
        <span className="font-monospace small">
          ₱{(row.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      minWidth: '110px',
      sortable: true,
      render: (row) => {
        let badgeClass = 'bg-secondary-subtle text-secondary';
        if (row.status === 'POSTED') badgeClass = 'bg-success-subtle text-success border-success-subtle';
        if (row.status === 'PENDING') badgeClass = 'bg-warning-subtle text-warning border-warning-subtle';
        if (row.status === 'VOIDED') badgeClass = 'bg-danger-subtle text-danger border-danger-subtle';
        return <span className={`badge ${badgeClass} border`}>{row.status}</span>;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      minWidth: '170px',
      render: (row) => {
        if (row.status === 'PENDING') {
          const isBusy = processingId === row.transactionId;
          return (
            <div className="d-flex justify-content-end gap-1">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => handleCancel(row.transactionId)}
                disabled={isBusy}
                title="Cancel draft (VOID)"
              >
                Void
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm d-flex align-items-center gap-1"
                onClick={() => handleCommit(row.transactionId)}
                disabled={isBusy}
                title="Commit & Execute Stock Movement"
              >
                {isBusy ? (
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                ) : (
                  <>
                    <i className="bi bi-check2"></i> Commit
                  </>
                )}
              </button>
            </div>
          );
        }

        return (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setSelectedTx(row)}
          >
            <i className="bi bi-eye"></i> View
          </button>
        );
      }
    }
  ];

  return (
    <div>
      <DataCard<any>
        title="Double-Entry Transaction Ledger"
        description="Immutable facilities inventory ledger tracking receipts, dispatches, tool deployments, and staging drafts."
        actions={[{ key: 'stage', label: 'Stage New Transaction', icon: 'bi-plus-circle', onClick: () => setIsCreateOpen(true) }]}
        onRefresh={() => { invalidateCache('transaction:history'); fetchTransactions(); }}
        tabs={[
          { key: 'ALL', label: 'All Movements' },
          { key: 'PENDING', label: 'Pending Review', badge: pendingCount },
          { key: 'POSTED', label: 'Posted / Executed' },
          { key: 'VOIDED', label: 'Voided / Cancelled' }
        ]}
        activeTab={statusFilter}
        onTabChange={(k) => setStatusFilter(k as typeof statusFilter)}
        data={filteredTransactions}
        columns={columns}
        keyField="transactionId"
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by TXN ID, source, destination, notes..."
        isLoading={isLoading && transactions.length === 0}
        refreshing={isLoading}
        emptyMessage="No transaction ledger records found."
      />

      {/* Line Item Detail Modal */}
      {selectedTx && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} tabIndex={-1}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold font-monospace text-primary mb-0">
                    {selectedTx.transactionId}
                  </h5>
                  <span className="small text-muted">{selectedTx.timestamp} • {selectedTx.transactionType}</span>
                </div>
                <button type="button" className="btn-close" onClick={() => setSelectedTx(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <span className="text-muted small d-block">Source:</span>
                    <span className="fw-semibold small">{selectedTx.sourceRefId} ({selectedTx.sourceType})</span>
                  </div>
                  <div className="col-md-4">
                    <span className="text-muted small d-block">Destination:</span>
                    <span className="fw-semibold small">{selectedTx.destinationRefId || 'N/A'} ({selectedTx.destinationType})</span>
                  </div>
                  <div className="col-md-4">
                    <span className="text-muted small d-block">Accountable Party:</span>
                    <span className="fw-semibold small">{selectedTx.accountablePartyId || 'N/A'}</span>
                  </div>
                  {selectedTx.remarks && (
                    <div className="col-12">
                      <span className="text-muted small d-block">Remarks & Audit Notes:</span>
                      <p className="small bg-light p-2 rounded mb-0 text-dark">{selectedTx.remarks}</p>
                    </div>
                  )}
                </div>

                <h6 className="fw-bold small text-uppercase text-muted mb-2">Line Items Snapshot</h6>
                <div className="table-responsive border rounded">
                  <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Entry ID</th>
                        <th>Item SKU & Name</th>
                        <th>Serial</th>
                        <th className="text-end">Qty</th>
                        <th>UOM</th>
                        <th className="text-end">Unit Cost</th>
                        <th className="text-end">Total Cost</th>
                        <th>Delivery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTx.items?.length > 0 ? (
                        selectedTx.items.map((item: TransactionLineItem) => (
                          <tr key={item.entryId}>
                            <td className="font-monospace text-muted">{item.entryId}</td>
                            <td>
                              <span className="font-monospace fw-semibold text-primary">{item.sku}</span>
                              <div className="small text-dark">{item.name}</div>
                            </td>
                            <td><span className="small text-muted">{item.serialNumber || 'N/A'}</span></td>
                            <td className="text-end fw-bold">{item.quantity}</td>
                            <td>{item.uom}</td>
                            <td className="text-end font-monospace">₱{(item.unitCost || 0).toFixed(2)}</td>
                            <td className="text-end font-monospace fw-bold">₱{(item.totalCost || 0).toFixed(2)}</td>
                            <td className="font-monospace small text-muted">{item.layerId || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center text-muted py-3">No line items snapshot recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer bg-light border-top">
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedTx(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage New Transaction Modal */}
      {isCreateOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-primary text-white border-bottom">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-clock-history"></i>
                  Stage New Pending Transaction
                </h5>
                <button type="button" className="btn-close btn-close-white" disabled={isSubmittingNew} onClick={() => setIsCreateOpen(false)}></button>
              </div>

              <form onSubmit={handleCreateStaged}>
                <div className="modal-body p-4">
                  {createError && (
                    <div className="alert alert-danger py-2 small mb-3">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      {createError}
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Classification Type *</label>
                      <select
                        className="form-select form-select-sm"
                        value={newTxType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewTxType(val);
                          // The API validates source/destination per type, so set them (and sensible refs) with the type.
                          const WH = 'FACILITIES_WAREHOUSE_MAIN';
                          const presets: Record<string, [string, string, string, string]> = {
                            'OUT:RELEASE': ['INVENTORY', WH, 'ACTIVITY', ''],
                            'OUT:DEPLOY': ['INVENTORY', WH, 'IN_HOUSE', ''],
                            'IN:EXCESS': ['ACTIVITY', '', 'INVENTORY', WH],
                            'IN:RETRIEVE': ['IN_HOUSE', '', 'INVENTORY', WH],
                            'TRANSFER:INVENTORY': ['INVENTORY', WH, 'INVENTORY', '']
                          };
                          const preset = presets[val];
                          if (preset) {
                            setNewSourceType(preset[0]);
                            setNewSourceRefId(preset[1]);
                            setNewDestType(preset[2]);
                            setNewDestRefId(preset[3]);
                          }
                        }}
                      >
                        <option value="OUT:RELEASE">Outbound Project Dispatch (OUT:RELEASE)</option>
                        <option value="OUT:DEPLOY">Staff Tool Custody Assignment (OUT:DEPLOY)</option>
                        <option value="IN:EXCESS">Surplus Return from Project (IN:EXCESS)</option>
                        <option value="IN:RETRIEVE">Tool Custody Surrender (IN:RETRIEVE)</option>
                        <option value="TRANSFER:INVENTORY">Internal Warehouse Relocation (TRANSFER:INVENTORY)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Accountable Party / Custodian</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. technician.lead@jjjentinc.com"
                        value={newAccountableParty}
                        onChange={(e) => setNewAccountableParty(e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Source Location / Ref *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={newSourceRefId}
                        onChange={(e) => setNewSourceRefId(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Destination Reference (e.g. Activity Code) *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. ACT-2026-0042"
                        value={newDestRefId}
                        onChange={(e) => setNewDestRefId(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <hr className="my-2" />
                      <h6 className="fw-bold small text-muted text-uppercase mb-2">Item Line</h6>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Item ID *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. ITM-0001"
                        value={newItemId}
                        onChange={(e) => setNewItemId(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm"
                        value={newQty}
                        onChange={(e) => setNewQty(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Serial Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="N/A or Specific Serial"
                        value={newSerial}
                        onChange={(e) => setNewSerial(e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Remarks</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Staging notes or work order reason"
                        value={newRemarks}
                        onChange={(e) => setNewRemarks(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top">
                  <button type="button" className="btn btn-sm btn-secondary" disabled={isSubmittingNew} onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={isSubmittingNew}>
                    {isSubmittingNew ? 'Drafting...' : 'Save Staged Draft (PENDING)'}
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
