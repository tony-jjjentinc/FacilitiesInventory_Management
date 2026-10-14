/**
 * @file SubDepartmentCustodyTab.tsx
 * @description Custody of a sub-department: the tools its people hold, and what it has consumed. A switch picks the list.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataCard } from '../DataCard';
import type { Column } from '../DataTable';
import type { SubDepartmentCustody } from '../../types';
import { entityPath, peso, qty } from './entityPaths';
import { useEntityData } from './useEntity';
import { getCurrentUser } from '../../services/auth';
import { getAccess, hideCosts } from '../../services/access';
import { fmtDateTime } from '../../utils/datetime';

type Tool = SubDepartmentCustody['tools'][number];
type Used = SubDepartmentCustody['consumed'][number];
const item = (id: string, name: string) => <div><Link to={entityPath('ITEM', id)} className="fw-semibold text-decoration-none">{name || id}</Link><div className="small text-muted">{id}</div></div>;

export const SubDepartmentCustodyTab: React.FC<{ name: string }> = ({ name }) => {
  const { data, loading, refreshing, error, reload } = useEntityData<SubDepartmentCustody>('getCustody', 'SUBDEPARTMENT', name);
  const [view, setView] = useState<'tools' | 'consumed'>('tools');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const tools = useMemo(() => (data?.tools || []).filter(t => !q || `${t.name} ${t.itemId} ${t.custodian} ${t.serialNumber}`.toLowerCase().includes(q)), [data, q]);
  const used = useMemo(() => (data?.consumed || []).filter(c => !q || `${c.name} ${c.itemId} ${c.reference} ${c.purpose}`.toLowerCase().includes(q)), [data, q]);

  const toolCols: Column<Tool>[] = [
    { key: 'name', label: 'Tool', sortable: true, minWidth: '220px', render: t => item(t.itemId, t.name) },
    { key: 'custodian', label: 'Custodian', sortable: true, minWidth: '150px', render: t => t.custodian || '–' },
    { key: 'serialNumber', label: 'Serial', minWidth: '100px', render: t => t.serialNumber && t.serialNumber !== 'N/A' ? t.serialNumber : '–' },
    { key: 'qty', label: 'Quantity', align: 'right', minWidth: '90px', render: t => `${qty(t.qty)} ${t.uom}` },
    { key: 'assignedAt', label: 'Assigned', sortable: true, minWidth: '100px', render: t => t.assignedAt || '–' },
    { key: 'lastUsedAt', label: 'Last used', sortable: true, minWidth: '100px', render: t => t.lastUsedAt || 'Never' },
    { key: 'status', label: 'Status', align: 'center', minWidth: '110px' }
  ];
  const usedCols: Column<Used>[] = [
    { key: 'at', label: 'When', sortable: true, minWidth: '140px', render: c => fmtDateTime(c.at) },
    { key: 'name', label: 'Item', sortable: true, minWidth: '220px', render: c => item(c.itemId, c.name) },
    { key: 'qty', label: 'Quantity', align: 'right', minWidth: '90px', render: c => `${qty(c.qty)} ${c.uom}` },
    { key: 'cost', label: 'Cost', align: 'right', sortable: true, minWidth: '100px', render: c => peso(c.cost) },
    { key: 'reference', label: 'Used for', minWidth: '160px', render: c => c.reference || '–' },
    { key: 'purpose', label: 'Purpose', minWidth: '160px', render: c => c.purpose || '–' }
  ];
  const switcher = (
    <div className="btn-group" role="radiogroup" aria-label="Custody list">
      <button type="button" role="radio" aria-checked={view === 'tools'} className={`btn btn-sm ${view === 'tools' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('tools')}>Tools</button>
      <button type="button" role="radio" aria-checked={view === 'consumed'} className={`btn btn-sm ${view === 'consumed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('consumed')}>Consumed</button>
    </div>
  );

  const access = getAccess(getCurrentUser());
  if (error && !data) return <div className="alert alert-danger small">{error}</div>;
  const common = { isLoading: loading && !data, searchQuery: search, onSearchChange: setSearch, onRefresh: reload, refreshing, toolbar: switcher } as const;
  return view === 'tools'
    ? <DataCard<Tool> title="Inventory item custody" description="Tools held by people of this sub-department." columns={toolCols} data={tools} keyField="custodyId" searchPlaceholder="Search by tool, custodian, serial..." emptyMessage="No tools in custody." {...common} />
    : <DataCard<Used> title="Inventory item custody" description="Items this sub-department consumed this fiscal year." columns={hideCosts(usedCols, access)} data={used} keyField="consumptionId" searchPlaceholder="Search by item, use, purpose..." emptyMessage="Nothing consumed yet." {...common} />;
};
