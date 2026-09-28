import React, { useState } from 'react';
import { apiRequest } from '../services/api';
import type { LossIncident } from '../types';
import { DataTable, type Column } from '../components/DataTable';

export const ApprovalsQueue: React.FC = () => {
  const [incidents, setIncidents] = useState<LossIncident[]>([
    {
      lossId: 'LOSS-2026-0001',
      incidentDate: '2026-09-27 14:20',
      lossType: 'DAMAGE',
      originType: 'INVENTORY',
      originRefId: 'FACILITIES_WAREHOUSE_MAIN',
      liablePartyId: 'technician.m@jjjei.com',
      authorizedById: '',
      approvalStatus: 'PENDING_APPROVAL',
      approvedAt: '',
      transactionId: '',
      incidentDescription: 'PPR pipe cracked during forklift aisle transit. Unusable for high pressure lines.',
      attachmentUrl: 'https://drive.google.com/open?id=mock_file'
    },
    {
      lossId: 'LOSS-2026-0002',
      incidentDate: '2026-09-28 08:45',
      lossType: 'EXPIRATION',
      originType: 'INVENTORY',
      originRefId: 'FACILITIES_WAREHOUSE_MAIN',
      liablePartyId: 'custodian.warehouse@jjjei.com',
      authorizedById: '',
      approvalStatus: 'PENDING_APPROVAL',
      approvedAt: '',
      transactionId: '',
      incidentDescription: 'Epoxy resin hardener canisters passed manufacturer expiration date. Solidified in container.',
      attachmentUrl: ''
    }
  ]);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const handleApprove = async (lossId: string) => {
    setProcessingId(lossId);
    try {
      await apiRequest('incident:approve', {
        lossId,
        remarks: 'Approved by Department Head'
      });
      setIncidents(incidents.filter(i => i.lossId !== lossId));
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (lossId: string) => {
    setIncidents(incidents.filter(i => i.lossId !== lossId));
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
      minWidth: '100px',
      sortable: true,
      render: (row) => (
        <span className="badge bg-secondary-subtle text-secondary border">
          {row.lossType}
        </span>
      )
    },
    {
      key: 'originRefId',
      label: 'Location / Ref',
      align: 'left',
      minWidth: '160px',
      sortable: true,
      render: (row) => <span className="small text-muted">{row.originRefId}</span>
    },
    {
      key: 'liablePartyId',
      label: 'Reported By',
      align: 'left',
      minWidth: '160px',
      sortable: true,
      render: (row) => <span className="small text-dark">{row.liablePartyId}</span>
    },
    {
      key: 'incidentDescription',
      label: 'Incident Description',
      align: 'left',
      minWidth: '240px',
      render: (row) => (
        <div>
          <div className="small text-dark">{row.incidentDescription}</div>
          {row.attachmentUrl ? (
            <a
              href={row.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="small text-primary text-decoration-none mt-1 d-inline-block"
            >
              View Evidence Attachment
            </a>
          ) : null}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Decision',
      align: 'right',
      minWidth: '160px',
      render: (row) => (
        <div className="d-flex justify-content-end gap-1">
          <button
            type="button"
            className="btn btn-outline-danger btn-sm py-0 px-2"
            style={{ height: '28px', fontSize: '0.75rem' }}
            onClick={() => handleReject(row.lossId)}
            disabled={processingId === row.lossId}
          >
            Reject
          </button>
          <button
            type="button"
            className="btn btn-dark btn-sm py-0 px-2"
            style={{ height: '28px', fontSize: '0.75rem' }}
            onClick={() => handleApprove(row.lossId)}
            disabled={processingId === row.lossId}
          >
            {processingId === row.lossId ? '...' : 'Approve'}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-2 border-bottom">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Incident Approvals Queue</h4>
          <p className="text-muted small mb-0">
            Formal sign-off for damaged, scrap, expired, and lost warehouse inventory.
          </p>
        </div>

        <span className="badge bg-secondary-subtle text-secondary border">
          {incidents.length} Pending
        </span>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredIncidents}
        keyField="lossId"
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter incidents by ID, description, or reporter..."
        emptyMessage="All filed incident write-offs have been reviewed."
      />
    </div>
  );
};
