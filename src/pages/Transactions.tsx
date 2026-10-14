import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useDialog } from '../context/DialogContext';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import type { TransactionEntry, TransactionLineItem } from '../types';
import type { Column } from '../components/DataTable';
import { DataCard } from '../components/DataCard';
import { Loading } from '../components/Loading';
import { getCurrentUser } from '../services/auth';
import { getAccess } from '../services/access';
import { useDraft } from '../components/drafts/useDraft';
import { useResumeParam } from '../components/drafts/useResumeParam';
import { DraftActions, DraftResume } from '../components/drafts/DraftBar';
import { fmtDateTime } from '../utils/datetime';
import { ItemSelect } from '../components/form/ItemSelect';

export const Transactions: React.FC = () => {
  const toast = useToast();
  const dialog = useDialog();
  const access = getAccess(getCurrentUser());
  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'POSTED' | 'VOIDED'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Detail Modal State
  const [selectedTx, setSelectedTx] = useState<TransactionEntry | null>(null);

  // New Staged Transaction Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTxType, setNewTxType] = useState(access.fieldOnly ? 'IN:EXCESS' : 'OUT:RELEASE');
  const [newSourceType, setNewSourceType] = useState(access.fieldOnly ? 'ACTIVITY' : 'INVENTORY');
  const [newSourceRefId, setNewSourceRefId] = useState(access.fieldOnly ? '' : 'FACILITIES_WAREHOUSE_MAIN');
  const [newDestType, setNewDestType] = useState(access.fieldOnly ? 'INVENTORY' : 'ACTIVITY');
  const [newDestRefId, setNewDestRefId] = useState(access.fieldOnly ? 'FACILITIES_WAREHOUSE_MAIN' : '');
  const [newAccountableParty, setNewAccountableParty] = useState('');
  const [newRemarks, setNewRemarks] = useState('');
  const [newItemId, setNewItemId] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newSerial, setNewSerial] = useState('');
  const [createError, setCreateError] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // saved progress on the staging form: one draft per transaction type, kept on the server for 24 hours
  const draftState = useMemo(() => ({
    transactionType: newTxType, newTxType, newSourceType, newSourceRefId, newDestType, newDestRefId, newAccountableParty, newRemarks, newItemId, newQty, newSerial
  }), [newTxType, newSourceType, newSourceRefId, newDestType, newDestRefId, newAccountableParty, newRemarks, newItemId, newQty, newSerial]);
  const draft = useDraft({
    formType: 'STAGED_TX', identifier: newTxType, enabled: isCreateOpen, state: draftState,
    restore: s => {
      setNewSourceType(s.newSourceType); setNewSourceRefId(s.newSourceRefId); setNewDestType(s.newDestType); setNewDestRefId(s.newDestRefId);
      setNewAccountableParty(s.newAccountableParty); setNewRemarks(s.newRemarks); setNewItemId(s.newItemId); setNewQty(s.newQty); setNewSerial(s.newSerial);
    }
  });

  // `?resume=<transaction type>` (from the dashboard's Drafts list): open the staging form with that type's saved draft
  const resumeParam = useResumeParam('ledger');
  const [autoResume, setAutoResume] = useState('');
  useEffect(() => {
    if (!resumeParam.value) return;
    setNewTxType(resumeParam.value); setIsCreateOpen(true); setAutoResume(resumeParam.value);
    resumeParam.done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeParam.value]);
  useEffect(() => {
    if (!autoResume || !draft.looked || newTxType !== autoResume) return;
    if (draft.existing) draft.resume(); else setCreateError('That draft is no longer saved (drafts are kept for 24 hours).');
    setAutoResume('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResume, draft.looked, draft.existing, newTxType]);

  const fetchTransactions = useCallback(async () => {
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
  }, [statusFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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
    if (!await dialog.confirm({ title: `Commit ${txId}`, message: 'This posts the transaction and changes the warehouse stock. It cannot be undone here.', confirmText: 'Commit' })) return;
    setProcessingId(txId);
    try {
      await apiRequest('transaction:commit', { transactionId: txId });
      invalidateCache('transaction:history');
      invalidateCache('inventory:stock');
      invalidateCache('custody:list');
      invalidateCache('activity');
      fetchTransactions();
      toast.success(`Transaction ${txId} was committed.`);
    } catch (err: any) {
      toast.error(`Commit failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (txId: string) => {
    const reason = await dialog.prompt({ title: `Cancel ${txId}`, label: 'Why is it cancelled?', confirmText: 'Cancel transaction', danger: true });
    if (reason === null) return;

    setProcessingId(txId);
    try {
      await apiRequest('transaction:cancel', { transactionId: txId, reason });
      invalidateCache('transaction:history');
      fetchTransactions();
      toast.success(`Transaction ${txId} was cancelled.`);
    } catch (err: any) {
      toast.error(`Cancel failed: ${err.message}`);
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
        draftId: draft.draftId,
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

      toast.success('Staged transaction saved as pending.');
      draft.clear();
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

  const allColumns: Column<TransactionEntry>[] = [
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
      render: (row) => <span className="small text-muted">{fmtDateTime(row.timestamp)}</span>
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
          <span className="small fw-semibold text-dark" title={row.sourceRefId}>{row.sourceName || row.sourceRefId}</span>
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
          <span className="small fw-semibold text-dark" title={row.destinationRefId}>{row.destinationName || row.destinationRefId || 'N/A'}</span>
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
        if (row.status === 'PENDING' && access.isCustodian) {
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
                  <Loading variant="button" showLabel={false} />
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
  const columns = allColumns.filter(c => access.canSeeCosts || c.key !== 'totalCost');

  return (
    <div>
      <DataCard<any>
        title="Double-Entry Transaction Ledger"
        description="Immutable facilities inventory ledger tracking receipts, dispatches, tool deployments, and staging drafts."
        actions={[{ key: 'stage', label: 'Stage New Transaction', onClick: () => setIsCreateOpen(true) }]}
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
                  <span className="small text-muted">{fmtDateTime(selectedTx.timestamp)} • {selectedTx.transactionType}</span>
                </div>
                <button type="button" className="btn-close" onClick={() => setSelectedTx(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <span className="text-muted small d-block">Source:</span>
                    <span className="fw-semibold small">{selectedTx.sourceName ? `${selectedTx.sourceName} · ${selectedTx.sourceRefId}` : selectedTx.sourceRefId} ({selectedTx.sourceType})</span>
                  </div>
                  <div className="col-md-4">
                    <span className="text-muted small d-block">Destination:</span>
                    <span className="fw-semibold small">{selectedTx.destinationName ? `${selectedTx.destinationName} · ${selectedTx.destinationRefId}` : (selectedTx.destinationRefId || 'N/A')} ({selectedTx.destinationType})</span>
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
                        {access.canSeeCosts && <th className="text-end">Unit Cost</th>}
                        {access.canSeeCosts && <th className="text-end">Total Cost</th>}
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
                            {access.canSeeCosts && <td className="text-end font-monospace">₱{(item.unitCost || 0).toFixed(2)}</td>}
                            {access.canSeeCosts && <td className="text-end font-monospace fw-bold">₱{(item.totalCost || 0).toFixed(2)}</td>}
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
                  <DraftResume draft={draft} what={`${newTxType} transactions`} />
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
                        {!access.fieldOnly && <option value="OUT:RELEASE">Outbound Project Dispatch (OUT:RELEASE)</option>}
                        {!access.fieldOnly && <option value="OUT:DEPLOY">Staff Tool Custody Assignment (OUT:DEPLOY)</option>}
                        <option value="IN:EXCESS">Surplus Return from Project (IN:EXCESS)</option>
                        {!access.fieldOnly && <option value="IN:RETRIEVE">Tool Custody Surrender (IN:RETRIEVE)</option>}
                        {!access.fieldOnly && <option value="TRANSFER:INVENTORY">Internal Warehouse Relocation (TRANSFER:INVENTORY)</option>}
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
                      <ItemSelect required value={newItemId} onChange={setNewItemId} />
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
                  <DraftActions draft={draft} />
                  <button type="button" className="btn btn-sm btn-secondary" disabled={isSubmittingNew} onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={isSubmittingNew}>
                    {isSubmittingNew ? <Loading variant="button" label="Drafting..." /> : 'Save Staged Draft (PENDING)'}
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
