import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { DataTable, type Column } from '../../components/DataTable';
import type { ConsumedInventoryItem } from '../../types';

/** Every material consumption logged against an activity, newest first. */
export const ConsumptionLog: React.FC = () => {
  const [rows, setRows] = useState<ConsumedInventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<ConsumedInventoryItem[]>('inventory:getConsumedItems', { scope: 'ACTIVITY', limit: 1000 });
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load the consumption log.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const activities = useMemo(() => Array.from(new Set(rows.map(r => r.Reference_ID).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (!activity || r.Reference_ID === activity) &&
      (!q || [r.Consumption_ID, r.Reference_ID, r.Reference_Name, r.Item_ID, r.Item_Name, r.Item_SKU, r.Purpose, r.Work_Description, r.Logged_By_ID].join(' ').toLowerCase().includes(q))
    );
  }, [rows, search, activity]);

  const columns: Column<ConsumedInventoryItem>[] = [
    {
      key: 'Reference_ID',
      label: 'Activity',
      sortable: true,
      minWidth: '180px',
      render: (row) => (
        <div>
          <span className="font-monospace fw-semibold text-dark">{row.Reference_ID}</span>
          <div className="small text-muted">{row.Reference_Name}</div>
        </div>
      )
    },
    {
      key: 'Timestamp',
      label: 'Consumption ID',
      sortable: true,
      minWidth: '140px',
      render: (row) => (
        <div>
          <span className="font-monospace fw-semibold text-success">{row.Consumption_ID}</span>
          <div className="small text-muted">{row.Timestamp}</div>
        </div>
      )
    },
    {
      key: 'Item_Name',
      label: 'Material / Tool',
      sortable: true,
      minWidth: '220px',
      render: (row) => (
        <div>
          <div className="fw-medium text-dark">{row.Item_Name}</div>
          <div className="small text-secondary font-monospace">{row.Item_ID} &bull; {row.Item_SKU}</div>
        </div>
      )
    },
    {
      key: 'Quantity',
      label: 'Qty Consumed',
      sortable: true,
      align: 'right',
      minWidth: '110px',
      render: (row) => <span className="fw-bold text-dark">{row.Quantity} {row.UOM}</span>
    },
    {
      key: 'Unit_Cost',
      label: 'Unit Cost',
      align: 'right',
      minWidth: '100px',
      render: (row) => `₱${Number(row.Unit_Cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      key: 'Total_Cost',
      label: 'Total Billed',
      sortable: true,
      align: 'right',
      minWidth: '110px',
      render: (row) => <span className="fw-semibold text-primary">₱${Number(row.Total_Cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
    },
    {
      key: 'Purpose',
      label: 'Purpose & Installation Work',
      minWidth: '230px',
      render: (row) => (
        <div>
          <div className="fw-semibold text-dark small">{row.Purpose || 'N/A'}</div>
          {row.Work_Description && <div className="text-secondary small">{row.Work_Description}</div>}
        </div>
      )
    },
    {
      key: 'Logged_By_ID',
      label: 'Logged By',
      minWidth: '160px',
      render: (row) => (
        <div>
          <div className="small text-dark">{row.Logged_By_ID}</div>
          {row.Transaction_ID && <span className="badge bg-light text-dark font-monospace border">{row.Transaction_ID}</span>}
        </div>
      )
    }
  ];

  return (
    <div className="container py-4 px-3 px-md-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Consumption Log</h4>
          <p className="text-muted small mb-0">Materials logged as used on activities. Log new usage from the Allocation tab.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>{loading ? 'Updating...' : 'Refresh'}</button>
      </div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="card shadow-sm border-0">
        <DataTable
          columns={columns}
          data={filtered}
          keyField="Consumption_ID"
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search"
          isLoading={loading}
          emptyMessage="No consumption has been logged yet."
          filters={
            <select className="form-select form-select-sm" style={{ width: '200px' }} aria-label="Filter by activity" value={activity} onChange={e => setActivity(e.target.value)}>
              <option value="">All activities</option>
              {activities.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          }
        />
      </div>
    </div>
  );
};
