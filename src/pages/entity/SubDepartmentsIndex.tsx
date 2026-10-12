import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { fetchWithSwr, invalidateCache } from '../../services/cache';
import { DataCard } from '../../components/DataCard';
import type { Column } from '../../components/DataTable';
import type { SubDepartmentListRow } from '../../types';
import { entityPath, peso, qty } from '../../components/entity/entityPaths';
import { getCurrentUser } from '../../services/auth';
import { getAccess, hideCosts } from '../../services/access';

/** /sub-departments: each sub-department you may open (Sub-Department users see only their own). */
export const SubDepartmentsIndex: React.FC = () => {
  const [rows, setRows] = useState<SubDepartmentListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const load = () => fetchWithSwr<{ rows: SubDepartmentListRow[] }>('entity:list:SUBDEPARTMENT', () => apiRequest('entity:list', { scopeType: 'SUBDEPARTMENT' }), d => { setRows(d.rows); setLoading(false); })
    .catch(e => setError(e.message || 'Failed to load the sub-departments.')).finally(() => { setLoading(false); setRefreshing(false); });
  useEffect(() => { load(); }, []);

  const columns: Column<SubDepartmentListRow>[] = [
    { key: 'name', label: 'Sub-Department', sortable: true, minWidth: '220px', render: r => <Link to={entityPath('SUBDEPARTMENT', r.name)} className="fw-semibold text-decoration-none">{r.name}</Link> },
    { key: 'activities', label: 'Activities', align: 'right', sortable: true, minWidth: '90px' },
    { key: 'tools', label: 'Tools in custody', align: 'right', sortable: true, minWidth: '130px', render: r => qty(r.tools) },
    { key: 'consumedCost', label: 'Consumed this year', align: 'right', sortable: true, minWidth: '150px', render: r => peso(r.consumedCost) }
  ];
  const shown = rows.filter(r => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <div className="container py-4 px-3 px-md-4">
      {error && !rows.length && <div className="alert alert-danger small">{error}</div>}
      <DataCard title="Sub-Departments" description="Open a sub-department to see its custody, activities, losses and history." columns={hideCosts(columns, getAccess(getCurrentUser()))} data={shown} keyField="name"
        isLoading={loading && rows.length === 0} searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search sub-departments..."
        onRefresh={() => { invalidateCache('entity:list'); setRefreshing(true); load(); }} refreshing={refreshing} emptyMessage="No sub-departments yet." />
    </div>
  );
};
