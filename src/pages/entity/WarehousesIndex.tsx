import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { fetchWithSwr, invalidateCache } from '../../services/cache';
import { DataCard } from '../../components/DataCard';
import type { Column } from '../../components/DataTable';
import type { WarehouseListRow } from '../../types';
import { entityPath, peso } from '../../components/entity/entityPaths';
import { getCurrentUser, isUserHeadOrAdmin } from '../../services/auth';
import { WarehouseModal } from '../../components/entity/WarehouseForm';
import { useNavigate } from 'react-router-dom';
import { getAccess, hideCosts } from '../../services/access';

/** /warehouses: every warehouse with its stock value, items and areas. */
export const WarehousesIndex: React.FC = () => {
  const [rows, setRows] = useState<WarehouseListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const admin = isUserHeadOrAdmin(getCurrentUser());

  const load = () => fetchWithSwr<{ rows: WarehouseListRow[] }>('entity:list:WAREHOUSE', () => apiRequest('entity:list', { scopeType: 'WAREHOUSE' }), d => { setRows(d.rows); setLoading(false); })
    .catch(e => setError(e.message || 'Failed to load the warehouses.')).finally(() => { setLoading(false); setRefreshing(false); });
  useEffect(() => { load(); }, []);

  const columns: Column<WarehouseListRow>[] = [
    { key: 'name', label: 'Warehouse', sortable: true, minWidth: '240px', render: r => (
      <div><Link to={entityPath('WAREHOUSE', r.id)} className="fw-semibold text-decoration-none">{r.name}</Link><div className="small text-muted">{r.id}</div></div>
    ) },
    { key: 'areas', label: 'Areas', align: 'right', sortable: true, minWidth: '80px' },
    { key: 'items', label: 'Items', align: 'right', sortable: true, minWidth: '80px' },
    { key: 'stockValue', label: 'Stock value', align: 'right', sortable: true, minWidth: '140px', render: r => peso(r.stockValue) }
  ];
  const shown = rows.filter(r => !search.trim() || `${r.name} ${r.id}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="container py-4 px-3 px-md-4">
      {error && !rows.length && <div className="alert alert-danger small">{error}</div>}
      <DataCard title="Warehouses" description="Open a warehouse to see its areas, stock and history." columns={hideCosts(columns, getAccess(getCurrentUser()))} data={shown} keyField="id"
        isLoading={loading && rows.length === 0} searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search warehouses..."
        onRefresh={() => { invalidateCache('entity:list'); setRefreshing(true); load(); }} refreshing={refreshing} emptyMessage="No warehouses yet."
        actions={admin ? [{ key: 'add', label: 'Add warehouse', icon: 'bi-plus-lg', onClick: () => setAdding(true) }] : []} />
      {adding && <WarehouseModal existingIds={rows.map(r => r.id)} onClose={() => setAdding(false)} onSaved={id => { setAdding(false); invalidateCache('entity:list'); navigate(entityPath('WAREHOUSE', id)); }} />}
    </div>
  );
};
