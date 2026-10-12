/**
 * @file SubDepartmentExtraTabs.tsx
 * @description Smaller tabs of the sub-department page: its activities, its loss incidents and its people.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import { ActivityCards } from '../ActivityCards';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';
import type { ActivityRecord, DirectoryAccount, SubDepartmentLoss } from '../../types';
import { entityPath, peso, qty } from './entityPaths';
import { useEntityData } from './useEntity';
import { getCurrentUser } from '../../services/auth';
import { getAccess, hideCosts } from '../../services/access';

/** Activities whose sub-department is this one. Clicking a card opens the activity page. */
export const SubDepartmentActivitiesTab: React.FC<{ name: string }> = ({ name }) => {
  const navigate = useNavigate();
  const [all, setAll] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchWithSwr<ActivityRecord[]>('activity:getAll', () => apiRequest('activity:getAll'), d => { if (Array.isArray(d)) setAll(d); setLoading(false); })
      .catch(e => setError(e.message || 'Failed to load the activities.')).finally(() => setLoading(false));
  }, []);
  const mine = useMemo(() => all.filter(a => String(a.Sub_Department || '').trim().toLowerCase() === name.toLowerCase()), [all, name]);
  if (error && all.length === 0) return <div className="alert alert-danger small">{error}</div>;
  return <ActivityCards activities={mine} loading={loading} onSelect={a => navigate(entityPath('ACTIVITY', a.Activity_ID))} />;
};

type LossRow = SubDepartmentLoss['rows'][number];
const STATUS: Record<string, string> = { PENDING_APPROVAL: 'Waiting for approval', APPROVED: 'Approved', REJECTED: 'Rejected', RECOVERED: 'Recovered' };

export const SubDepartmentLossTab: React.FC<{ name: string }> = ({ name }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<SubDepartmentLoss>('getLoss', 'SUBDEPARTMENT', name);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => (data?.rows || []).filter(r => !search.trim() || `${r.lossId} ${r.type} ${r.description}`.toLowerCase().includes(search.trim().toLowerCase())), [data, search]);
  const columns: Column<LossRow>[] = [
    { key: 'date', label: 'Date', sortable: true, minWidth: '100px', render: r => r.date || 'No Data' },
    { key: 'lossId', label: 'Incident', sortable: true, minWidth: '120px' },
    { key: 'type', label: 'Type', sortable: true, minWidth: '130px' },
    { key: 'qty', label: 'Quantity', align: 'right', minWidth: '90px', render: r => qty(r.qty) },
    { key: 'cost', label: 'Cost', align: 'right', sortable: true, minWidth: '100px', render: r => peso(r.cost) },
    { key: 'status', label: 'Status', align: 'center', minWidth: '150px', render: r => STATUS[r.status] || r.status },
    { key: 'description', label: 'What happened', minWidth: '220px', render: r => r.description || 'No Data' }
  ];
  const access = getAccess(getCurrentUser());
  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  return (
    <DataCard title="Loss and write-offs" description={data && access.canSeeCosts ? `Approved write-offs cost ${peso(data.totalCost)}.` : undefined}
      columns={hideCosts(columns, access)} data={rows} keyField="lossId" isLoading={loading && !data} searchQuery={search} onSearchChange={setSearch}
      searchPlaceholder="Search incidents..." onRefresh={reload} refreshing={refreshing} emptyMessage="No loss incidents." />
  );
};

export const SubDepartmentPeopleTab: React.FC<{ name: string }> = ({ name }) => {
  const [accounts, setAccounts] = useState<DirectoryAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    fetchWithSwr<DirectoryAccount[]>('accounts:directory', () => apiRequest('accounts:getDirectory'), d => { if (Array.isArray(d)) setAccounts(d); setLoading(false); })
      .catch(e => setError(e.message || 'Failed to load the accounts.')).finally(() => setLoading(false));
  }, []);
  const rows = useMemo(() => accounts.filter(a => a.subdepartments.some(s => s.toLowerCase() === name.toLowerCase()))
    .filter(a => !search.trim() || `${a.name} ${a.email} ${a.positions.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())), [accounts, name, search]);
  const columns: Column<DirectoryAccount>[] = [
    { key: 'name', label: 'Name', sortable: true, minWidth: '200px', render: a => <div><span className="fw-semibold text-dark">{a.name || a.email}</span><div className="small text-muted">{a.email}</div></div> },
    { key: 'positions', label: 'Position', minWidth: '160px', render: a => a.positions.join(', ') || 'No Data' },
    { key: 'roles', label: 'Role', minWidth: '140px', render: a => a.roles.join(', ') || 'No Data' }
  ];
  if (error && accounts.length === 0) return <div className="alert alert-danger small">{error}</div>;
  return (
    <DataCard title="People" description="Active accounts assigned to this sub-department (Facilities accounts)."
      columns={columns} data={rows} keyField="email" isLoading={loading && accounts.length === 0} searchQuery={search} onSearchChange={setSearch}
      searchPlaceholder="Search by name, email, position..." emptyMessage="No accounts are assigned to this sub-department." />
  );
};
