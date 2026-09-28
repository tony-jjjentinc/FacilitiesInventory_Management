import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmModal } from '../components/ConfirmModal';

type ConfigTableKey =
  | 'Item'
  | 'Supplier'
  | 'Item_Supplier_and_Pricing'
  | 'Inventory_Category'
  | 'UOM'
  | 'UOM_Category'
  | 'Warehouse_Location'
  | 'Sheet_Records';

interface ConfigTabDef {
  key: ConfigTableKey;
  label: string;
  idField: string;
  description: string;
}

const CONFIG_TABS: ConfigTabDef[] = [
  { key: 'Item', label: 'Master Items', idField: 'ID', description: 'Catalog items, trade categories, and physical classifications' },
  { key: 'Supplier', label: 'Suppliers', idField: 'Supplier_ID', description: 'Approved vendors, contact personnel, and corporate addresses' },
  { key: 'Item_Supplier_and_Pricing', label: 'Supplier Pricing', idField: 'Mapping_ID', description: 'Item-supplier links, contract prices, MOQ, and lead times' },
  { key: 'Inventory_Category', label: 'Trade Categories', idField: 'Category_ID', description: 'Technical trades (PLB, ELE, HVA, CIV, PWR, etc.)' },
  { key: 'UOM', label: 'Units of Measure', idField: 'UOM_Code', description: 'Measurement units and symbols (pc, box, mtr, set, kg)' },
  { key: 'UOM_Category', label: 'UOM Categories', idField: 'UOM_Category_ID', description: 'Unit dimensions (Count, Length, Volume, Mass, Area)' },
  { key: 'Warehouse_Location', label: 'Warehouse Locations', idField: 'Location_ID', description: 'Physical warehouses, storage aisles, and capacity limits' },
  { key: 'Sheet_Records', label: 'Fiscal Ledgers', idField: 'Year', description: 'Active and archived annual operational spreadsheets' }
];

export const Configuration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTableKey>('Item');
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Edit / Create Record Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
    isDanger: false
  });
  const [isActionPending, setIsActionPending] = useState(false);

  const currentTabDef = CONFIG_TABS.find(t => t.key === activeTab)!;

  const loadTableData = async (tableKey: ConfigTableKey) => {
    setIsLoading(true);
    const cacheKey = `config:${tableKey}`;

    try {
      await fetchWithSwr(
        cacheKey,
        async () => {
          const res = await apiRequest('config:getTable', { table: tableKey });
          return res.records || [];
        },
        (data, isInitialCache) => {
          setRecords(data);
          if (isInitialCache) {
            setIsLoading(false);
          }
        }
      );
    } catch (err) {
      console.error(`Failed to load ${tableKey}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSearch('');
    loadTableData(activeTab);
  }, [activeTab]);

  // Open Form for Editing
  const handleEditRecord = (record: any) => {
    setEditFormData({ ...record });
    setIsCreatingNew(false);
    setIsEditing(true);
  };

  // Open Form for Creating
  const handleCreateNew = () => {
    setEditFormData({ Status: 'ACTIVE', Is_Active: true });
    setIsCreatingNew(true);
    setIsEditing(true);
  };

  // Trigger Save with Confirmation
  const promptSaveConfirmation = () => {
    const idVal = editFormData[currentTabDef.idField] || 'New';
    const actionLabel = isCreatingNew ? 'create' : 'update';

    setConfirmModal({
      isOpen: true,
      title: `Confirm ${isCreatingNew ? 'Create' : 'Update'} in ${currentTabDef.label}`,
      message: `Are you sure you want to ${actionLabel} record '${idVal}' in '${currentTabDef.key}'? This will modify the central Master Spreadsheet.`,
      isDanger: false,
      action: async () => {
        setIsActionPending(true);
        try {
          await apiRequest('config:saveRecord', {
            table: currentTabDef.key,
            idField: currentTabDef.idField,
            record: editFormData
          });
          invalidateCache(`config:${currentTabDef.key}`);
          invalidateCache('catalog:items');
          setIsEditing(false);
          await loadTableData(activeTab);
        } catch (err: any) {
          alert(`Save failed: ${err.message}`);
        } finally {
          setIsActionPending(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Trigger Archive / Delete with Confirmation
  const promptDeleteConfirmation = (record: any) => {
    const idVal = record[currentTabDef.idField];
    setConfirmModal({
      isOpen: true,
      title: `Confirm Deactivate / Archive`,
      message: `Are you sure you want to archive or deactivate record '${idVal}' in '${currentTabDef.label}'?`,
      isDanger: true,
      action: async () => {
        setIsActionPending(true);
        try {
          await apiRequest('config:deleteRecord', {
            table: currentTabDef.key,
            idField: currentTabDef.idField,
            id: idVal
          });
          invalidateCache(`config:${currentTabDef.key}`);
          invalidateCache('catalog:items');
          await loadTableData(activeTab);
        } catch (err: any) {
          alert(`Archive failed: ${err.message}`);
        } finally {
          setIsActionPending(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Columns generator based on active tab
  const getColumnsForTab = (tab: ConfigTableKey): Column<any>[] => {
    switch (tab) {
      case 'Item':
        return [
          { key: 'SKU', label: 'SKU', align: 'left', minWidth: '130px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.SKU}</span> },
          { key: 'Name', label: 'Item Name', align: 'left', minWidth: '220px', sortable: true, render: (r) => <span className="fw-medium text-dark">{r.Name}</span> },
          { key: 'Category_ID', label: 'Category', align: 'left', minWidth: '100px', sortable: true },
          { key: 'Inventory_Type_Code', label: 'Type', align: 'left', minWidth: '80px', sortable: true },
          { key: 'UOM', label: 'UOM', align: 'center', minWidth: '70px', sortable: true },
          { key: 'Status', label: 'Status', align: 'center', minWidth: '85px', sortable: true, render: (r) => <span className={`badge ${r.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Status}</span> },
          {
            key: 'actions', label: 'Actions', align: 'right', minWidth: '130px', render: (r) => (
              <div className="d-flex justify-content-end gap-1">
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => handleEditRecord(r)}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => promptDeleteConfirmation(r)}>Archive</button>
              </div>
            )
          }
        ];

      case 'Supplier':
        return [
          { key: 'Supplier_ID', label: 'Supplier ID', align: 'left', minWidth: '120px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.Supplier_ID}</span> },
          { key: 'Supplier_Name', label: 'Company Name', align: 'left', minWidth: '220px', sortable: true, render: (r) => <span className="fw-medium text-dark">{r.Supplier_Name}</span> },
          { key: 'Contact_Person', label: 'Contact Person', align: 'left', minWidth: '160px', sortable: true },
          { key: 'Contact_Number', label: 'Contact Phone', align: 'left', minWidth: '130px' },
          { key: 'Email', label: 'Email Address', align: 'left', minWidth: '180px' },
          { key: 'Status', label: 'Status', align: 'center', minWidth: '85px', sortable: true, render: (r) => <span className={`badge ${r.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Status}</span> },
          {
            key: 'actions', label: 'Actions', align: 'right', minWidth: '130px', render: (r) => (
              <div className="d-flex justify-content-end gap-1">
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => handleEditRecord(r)}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => promptDeleteConfirmation(r)}>Archive</button>
              </div>
            )
          }
        ];

      case 'Item_Supplier_and_Pricing':
        return [
          { key: 'Mapping_ID', label: 'Mapping ID', align: 'left', minWidth: '120px', sortable: true, render: (r) => <span className="font-monospace text-muted">{r.Mapping_ID}</span> },
          { key: 'SKU', label: 'Item SKU', align: 'left', minWidth: '130px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.SKU}</span> },
          { key: 'Supplier_Name', label: 'Supplier', align: 'left', minWidth: '200px', sortable: true },
          { key: 'Price', label: 'Contract Price', align: 'right', minWidth: '120px', sortable: true, render: (r) => <span className="font-monospace small">PHP {Number(r.Price || 0).toFixed(2)}</span> },
          { key: 'Lead_Time_Days', label: 'Lead Time', align: 'right', minWidth: '100px', sortable: true, render: (r) => `${r.Lead_Time_Days || 0} days` },
          { key: 'Is_Primary_Supplier', label: 'Primary', align: 'center', minWidth: '85px', render: (r) => <span className="small">{r.Is_Primary_Supplier ? 'Yes' : 'No'}</span> },
          {
            key: 'actions', label: 'Actions', align: 'right', minWidth: '130px', render: (r) => (
              <div className="d-flex justify-content-end gap-1">
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => handleEditRecord(r)}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => promptDeleteConfirmation(r)}>Archive</button>
              </div>
            )
          }
        ];

      case 'Inventory_Category':
        return [
          { key: 'Category_ID', label: 'Trade Code', align: 'left', minWidth: '110px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.Category_ID}</span> },
          { key: 'Category_Name', label: 'Category Name', align: 'left', minWidth: '200px', sortable: true, render: (r) => <span className="fw-medium text-dark">{r.Category_Name}</span> },
          { key: 'Description', label: 'Description', align: 'left', minWidth: '260px' },
          { key: 'Status', label: 'Status', align: 'center', minWidth: '85px', sortable: true, render: (r) => <span className={`badge ${r.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Status}</span> },
          {
            key: 'actions', label: 'Actions', align: 'right', minWidth: '130px', render: (r) => (
              <div className="d-flex justify-content-end gap-1">
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => handleEditRecord(r)}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => promptDeleteConfirmation(r)}>Archive</button>
              </div>
            )
          }
        ];

      case 'UOM':
        return [
          { key: 'UOM_Code', label: 'UOM Code', align: 'left', minWidth: '100px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.UOM_Code}</span> },
          { key: 'UOM_Name', label: 'UOM Name', align: 'left', minWidth: '180px', sortable: true },
          { key: 'UOM_Category_ID', label: 'Dimension Category', align: 'left', minWidth: '160px', sortable: true },
          { key: 'Status', label: 'Status', align: 'center', minWidth: '85px', sortable: true, render: (r) => <span className={`badge ${r.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Status}</span> },
          {
            key: 'actions', label: 'Actions', align: 'right', minWidth: '130px', render: (r) => (
              <div className="d-flex justify-content-end gap-1">
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => handleEditRecord(r)}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => promptDeleteConfirmation(r)}>Archive</button>
              </div>
            )
          }
        ];

      case 'UOM_Category':
        return [
          { key: 'UOM_Category_ID', label: 'Category ID', align: 'left', minWidth: '140px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.UOM_Category_ID}</span> },
          { key: 'UOM_Category_Name', label: 'Category Name', align: 'left', minWidth: '180px', sortable: true },
          { key: 'Description', label: 'Description', align: 'left', minWidth: '260px' },
          { key: 'Status', label: 'Status', align: 'center', minWidth: '85px', sortable: true, render: (r) => <span className={`badge ${r.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Status}</span> },
          {
            key: 'actions', label: 'Actions', align: 'right', minWidth: '130px', render: (r) => (
              <div className="d-flex justify-content-end gap-1">
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => handleEditRecord(r)}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => promptDeleteConfirmation(r)}>Archive</button>
              </div>
            )
          }
        ];

      case 'Warehouse_Location':
        return [
          { key: 'Location_ID', label: 'Location ID', align: 'left', minWidth: '180px', sortable: true, render: (r) => <span className="font-monospace text-dark fw-semibold small">{r.Location_ID}</span> },
          { key: 'Location_Name', label: 'Location Name', align: 'left', minWidth: '200px', sortable: true },
          { key: 'Location_Type', label: 'Type', align: 'left', minWidth: '120px', sortable: true },
          { key: 'Building', label: 'Building', align: 'left', minWidth: '140px' },
          { key: 'Capacity', label: 'Capacity', align: 'right', minWidth: '90px' },
          { key: 'Is_Active', label: 'Active', align: 'center', minWidth: '85px', sortable: true, render: (r) => <span className={`badge ${r.Is_Active ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Is_Active ? 'Yes' : 'No'}</span> },
          {
            key: 'actions', label: 'Actions', align: 'right', minWidth: '130px', render: (r) => (
              <div className="d-flex justify-content-end gap-1">
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => handleEditRecord(r)}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => promptDeleteConfirmation(r)}>Archive</button>
              </div>
            )
          }
        ];

      case 'Sheet_Records':
        return [
          { key: 'Year', label: 'Fiscal Year', align: 'left', minWidth: '110px', sortable: true, render: (r) => <span className="fw-bold text-dark">{r.Year}</span> },
          { key: 'Spreadsheet_Name', label: 'Ledger Title', align: 'left', minWidth: '240px', sortable: true },
          { key: 'Spreadsheet_ID', label: 'Spreadsheet ID', align: 'left', minWidth: '220px', render: (r) => <span className="font-monospace text-muted small">{r.Spreadsheet_ID}</span> },
          { key: 'Status', label: 'Status', align: 'center', minWidth: '95px', sortable: true, render: (r) => <span className={`badge ${r.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Status}</span> },
          { key: 'Created_At', label: 'Registered Date', align: 'left', minWidth: '140px', render: (r) => <span className="small text-muted">{r.Created_At}</span> },
          {
            key: 'actions', label: 'Actions', align: 'right', minWidth: '130px', render: (r) => (
              <div className="d-flex justify-content-end gap-1">
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => handleEditRecord(r)}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm py-0 px-2" style={{ height: '26px', fontSize: '0.75rem' }} onClick={() => promptDeleteConfirmation(r)}>Archive</button>
              </div>
            )
          }
        ];
    }
  };

  const filteredRecords = records.filter(row => {
    if (!search) return true;
    const q = search.toLowerCase().trim();
    return Object.values(row).some(v => String(v || '').toLowerCase().includes(q));
  });

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-2 border-bottom">
        <div>
          <h4 className="fw-bold mb-1 text-dark">System Configuration & Master Registry</h4>
          <p className="text-muted small mb-0">
            Administrative governance: Manage catalog items, approved suppliers, trade codes, and yearly ledgers.
          </p>
        </div>

        <button className="btn btn-dark btn-sm" onClick={handleCreateNew}>
          Add {currentTabDef.label.slice(0, -1) || 'Record'}
        </button>
      </div>

      {/* Minimal Underline Tab Navigation */}
      <nav className="d-flex border-bottom mb-4 overflow-auto" aria-label="Configuration categories" style={{ gap: '1.75rem' }}>
        {CONFIG_TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={`btn btn-link text-decoration-none p-0 pb-2 border-0 bg-transparent text-nowrap ${
                isActive ? 'text-dark fw-semibold' : 'text-secondary'
              }`}
              style={{
                fontSize: '0.875rem',
                borderBottom: isActive ? '2px solid #0f172a' : '2px solid transparent',
                borderRadius: 0,
                marginBottom: '-1px',
                cursor: 'pointer'
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab Context Subtitle */}
      <div className="mb-3 d-flex justify-content-between align-items-center">
        <div className="small text-muted">
          Managing <strong>{currentTabDef.key}</strong>: {currentTabDef.description}
        </div>
        <button
          className="btn btn-link btn-sm text-decoration-none text-muted py-0"
          onClick={() => {
            invalidateCache(`config:${activeTab}`);
            loadTableData(activeTab);
          }}
          disabled={isLoading}
        >
          {isLoading ? 'Revalidating...' : 'Refresh'}
        </button>
      </div>

      {/* DataTable */}
      <DataTable
        columns={getColumnsForTab(activeTab)}
        data={filteredRecords}
        keyField={currentTabDef.idField}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Filter ${currentTabDef.label}...`}
        emptyMessage={`No ${currentTabDef.label} records found.`}
      />

      {/* Edit / Create Modal Form */}
      {isEditing && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1055 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border shadow-sm">
              <div className="modal-header py-3 px-4 bg-light border-bottom">
                <h6 className="modal-title fw-bold text-dark mb-0">
                  {isCreatingNew ? `Create New ${currentTabDef.label.slice(0, -1)}` : `Edit ${currentTabDef.label.slice(0, -1)}`}
                </h6>
                <button type="button" className="btn-close" onClick={() => setIsEditing(false)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3">
                  {Object.keys(editFormData).filter(k => k !== 'actions').map(k => (
                    <div key={k} className="col-12 col-md-6">
                      <label className="form-label small text-muted mb-1">{k.replace(/_/g, ' ')}</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={editFormData[k] !== undefined && editFormData[k] !== null ? String(editFormData[k]) : ''}
                        disabled={!isCreatingNew && k === currentTabDef.idField}
                        onChange={(e) => setEditFormData({ ...editFormData, [k]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer py-2 px-4 bg-light border-top d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-dark btn-sm" onClick={promptSaveConfirmation}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Action Confirmation Popup */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
        isLoading={isActionPending}
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
