import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import type { LossIncident } from '../types';
import type { Column } from '../components/DataTable';
import { DataCard } from '../components/DataCard';
import { ReportIncidentModal } from '../components/ReportIncidentModal';
import { getCurrentUser } from '../services/auth';

const isOwnIncident = (liablePartyId?: string) => {
  const me = getCurrentUser();
  const liable = String(liablePartyId || '').trim().toLowerCase();
  return !!liable && [me?.email, me?.name, me?.id].some(v => String(v || '').trim().toLowerCase() === liable);
};

export const ApprovalsQueue: React.FC = () => {
  const [incidents, setIncidents] = useState<LossIncident[]>([]);
  const [statusFilter, setStatusFilter] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'ALL'>('PENDING_APPROVAL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fetchIncidents = async () => {
    setIsLoading(true);
    const cacheKey = `incident:queue:${statusFilter}`;
    try {
      await fetchWithSwr<LossIncident[]>(
        cacheKey,
        () => apiRequest<LossIncident[]>('incident:getQueue', { status: statusFilter }),
        (data) => {
          if (Array.isArray(data)) {
            setIncidents(data);
          }
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error('Failed to load incident approvals queue:', err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter]);

  const handleApprove = async (lossId: string) => {
    const remarks = window.prompt('Enter approval remarks (optional):', 'Approved by Department Head');
    if (remarks === null) return; // User cancelled prompt

    setProcessingId(lossId);
    try {
      await apiRequest('incident:approve', {
        lossId,
        remarks: remarks.trim() || 'Approved by Department Head'
      });
      invalidateCache('incident:queue');
      invalidateCache('inventory:stock');
      invalidateCache('transaction:history');
      invalidateCache('custody:list');
      setIncidents(prev => prev.filter(i => i.lossId !== lossId));
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (lossId: string) => {
    const reason = window.prompt('Enter reason for rejecting this loss incident:');
    if (reason === null) return; // User cancelled prompt
    if (!reason.trim()) {
      alert('A rejection reason is required.');
      return;
    }

    setProcessingId(lossId);
    try {
      await apiRequest('incident:reject', {
        lossId,
        remarks: reason.trim()
      });
      invalidateCache('incident:queue');
      setIncidents(prev => prev.filter(i => i.lossId !== lossId));
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredIncidents = incidents.filter(i => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      i.lossId.toLowerCase().includes(q) ||
      i.incidentDescription.toLowerCase().includes(q) ||
      i.liablePartyId.toLowerCase().includes(q) ||
      i.lossType.toLowerCase().includes(q)
    );
  });

  const columns: Column<LossIncident>[] = [
    {
      key: 'lossId',
      label: 'Incident ID',
      align: 'left',
      minWidth: '130px',
      sortable: true,
      render: (row) => <span className="font-monospace fw-semibold text-dark">{row.lossId}</span>
    },
    {
      key: 'incidentDate',
      label: 'Incident Date',
      align: 'left',
      minWidth: '130px',
      sortable: true,
      render: (row) => <span className="small text-muted">{row.incidentDate}</span>
    },
    {
      key: 'lossType',
      label: 'Type',
      align: 'center',
      minWidth: '110px',
      sortable: true,
      render: (row) => {
        let badgeClass = 'bg-secondary-subtle text-secondary';
        if (row.lossType === 'DAMAGE') badgeClass = 'bg-danger-subtle text-danger';
        if (row.lossType === 'EXPIRATION') badgeClass = 'bg-warning-subtle text-warning';
        if (row.lossType === 'SCRAP') badgeClass = 'bg-dark-subtle text-dark';
        return <span className={`badge ${badgeClass} border`}>{row.lossType}</span>;
      }
    },
    {
      key: 'originRefId',
      label: 'Location / Ref',
      align: 'left',
      minWidth: '160px',
      sortable: true,
      render: (row) => <span className="small text-muted">{row.originRefId || 'N/A'}</span>
    },
    {
      key: 'liablePartyId',
      label: 'Reported By',
      align: 'left',
      minWidth: '160px',
      sortable: true,
      render: (row) => <span className="small text-dark">{row.liablePartyId || 'N/A'}</span>
    },
    {
      key: 'incidentDescription',
      label: 'Incident Description',
      align: 'left',
      minWidth: '240px',
      render: (row) => (
        <div>
          <span className="small text-dark text-wrap">{row.incidentDescription}</span>
          {row.attachmentUrl && (
            <div className="mt-1">
              <a
                href={row.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="small text-primary text-decoration-none d-inline-flex align-items-center gap-1"
              >
                <i className="bi bi-paperclip"></i> View Evidence
              </a>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'approvalStatus',
      label: 'Status',
      align: 'center',
      minWidth: '120px',
      render: (row) => (
        <span
          className={`badge border ${
            row.approvalStatus === 'APPROVED'
              ? 'bg-success-subtle text-success border-success-subtle'
              : row.approvalStatus === 'REJECTED'
              ? 'bg-danger-subtle text-danger border-danger-subtle'
              : 'bg-warning-subtle text-warning border-warning-subtle'
          }`}
        >
          {row.approvalStatus}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      minWidth: '160px',
      render: (row) => {
        if (row.approvalStatus !== 'PENDING_APPROVAL') {
          return <span className="text-muted small">Finalized</span>;
        }

        const isBusy = processingId === row.lossId;
        return (
          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => handleReject(row.lossId)}
              disabled={isBusy}
              title="Reject Write-off"
            >
              Reject
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm d-flex align-items-center gap-1"
              onClick={() => handleApprove(row.lossId)}
              disabled={isBusy || isOwnIncident(row.liablePartyId)}
              title={isOwnIncident(row.liablePartyId) ? 'You are the liable party and cannot approve this write-off' : 'Approve Write-off (OUT:DISPOSAL)'}
            >
              {isBusy ? (
                <span className="spinner-border spinner-border-sm" role="status"></span>
              ) : (
                <>
                  <i className="bi bi-check-circle"></i> Approve
                </>
              )}
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="container px-4 py-4">
      <DataCard<any>
        title="Loss & Disposal Approvals Queue"
        description="Review and digitally sign off on damage, expiration, and scrap reports requiring inventory disposal write-off."
        actions={[{ key: 'report', label: 'Report Incident', onClick: () => setIsReportModalOpen(true) }]}
        onRefresh={() => { invalidateCache('incident:queue'); fetchIncidents(); }}
        tabs={[
          { key: 'PENDING_APPROVAL', label: 'Pending Review' },
          { key: 'APPROVED', label: 'Approved' },
          { key: 'ALL', label: 'All Incidents' }
        ]}
        activeTab={statusFilter}
        onTabChange={(k) => setStatusFilter(k as typeof statusFilter)}
        data={filteredIncidents}
        columns={columns}
        keyField="lossId"
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by ID, liable party, description..."
        isLoading={isLoading && incidents.length === 0}
        refreshing={isLoading}
        emptyMessage="No loss incidents found for this filter."
      />

      {/* Report Incident Modal */}
      <ReportIncidentModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccess={() => {
          invalidateCache('incident:queue');
          fetchIncidents();
        }}
      />
    </div>
  );
};
