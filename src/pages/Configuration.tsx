import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import { getCachedData, fetchWithSwr, invalidateCache } from '../services/cache';
import { getCurrentUser } from '../services/auth';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmModal } from '../components/ConfirmModal';
import { RolloverWizard } from './RolloverWizard';

type ConfigTableKey =
  | 'Item'
  | 'Supplier'
  | 'Item_Supplier_and_Pricing'
  | 'Inventory_Category'
  | 'UOM'
  | 'UOM_Category'
  | 'Warehouse_Location'
  | 'Sheet_Records'
  | 'Rollover';

interface ConfigTabDef {
  key: ConfigTableKey;
  label: string;
  idField: string;
  description: string;
}

const CONFIG_TABS: ConfigTabDef[] = [
  { key: 'Item', label: 'Item Masterlist', idField: 'ID', description: 'Catalog items, trade categories, and physical classifications' },
  { key: 'Supplier', label: 'Suppliers', idField: 'ID', description: 'Approved vendors, contact personnel, and corporate addresses' },
  { key: 'Item_Supplier_and_Pricing', label: 'Supplier Pricing', idField: 'Record_ID', description: 'Item-supplier links, contract prices, MOQ, and lead times' },
  { key: 'Inventory_Category', label: 'Inventory Categories', idField: 'ID', description: 'Technical trades (PLB, ELE, HVA, CIV, PWR, etc.)' },
  { key: 'UOM', label: 'Units of Measure', idField: 'ID', description: 'Measurement units and symbols (pc, box, mtr, set, kg)' },
  { key: 'UOM_Category', label: 'UOM Categories', idField: 'ID', description: 'Unit dimensions (Count, Length, Volume, Mass, Area)' },
  { key: 'Warehouse_Location', label: 'Warehouse Locations', idField: 'ID', description: 'Physical warehouses, storage aisles, and capacity limits' },
  { key: 'Sheet_Records', label: 'Fiscal Source', idField: 'Year', description: 'Active and archived annual operational spreadsheets' },
  { key: 'Rollover', label: 'Fiscal Rollover', idField: 'Year', description: 'Annual operational ledger transition and opening balance carryover' }
];

export const Configuration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTableKey>('Item');
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);

  // Synchronous ref to prevent stale in-flight responses from overwriting current tab data
  const activeTabRef = useRef<ConfigTableKey>(activeTab);
  activeTabRef.current = activeTab;

  // Head Admin role verification
  const currentUser = getCurrentUser();
  const isHeadAdmin = Boolean(
    currentUser?.roles?.some(r => ['super admin', 'head'].includes(String(r).trim().toLowerCase()))
  );

  // Item View Modal State
  const [viewingItem, setViewingItem] = useState<any | null>(null);

  // State for config dropdown lookups in Item Masterlist editor
  const [lookupUoms, setLookupUoms] = useState<any[]>([]);
  const [lookupCategories, setLookupCategories] = useState<any[]>([]);
  const [lookupTypes, setLookupTypes] = useState<any[]>([]);

  // Item preview modal collapsible state
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(false);

  // Edit / Create Record Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [itemPropertiesPairs, setItemPropertiesPairs] = useState<{ key: string; value: string }[]>([]);
  const [isAdvancedSectionExpanded, setIsAdvancedSectionExpanded] = useState(false);

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

  // Lock body scroll whenever a modal is open
  const isAnyModalOpen = Boolean(viewingItem || isEditing || confirmModal.isOpen);
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isAnyModalOpen]);

  // Load lookup options for Item edit modal (UOMs, Categories, Types)
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [uomRes, catRes, typeRes] = await Promise.all([
          apiRequest('config:getTable', { table: 'UOM' }).catch(() => ({ records: [] })),
          apiRequest('config:getTable', { table: 'Inventory_Category' }).catch(() => ({ records: [] })),
          apiRequest('config:getTable', { table: 'Inventory_Type' }).catch(() => ({ records: [] }))
        ]);
        if (uomRes.records && uomRes.records.length > 0) setLookupUoms(uomRes.records);
        if (catRes.records && catRes.records.length > 0) setLookupCategories(catRes.records);
        if (typeRes.records && typeRes.records.length > 0) setLookupTypes(typeRes.records);
      } catch (err) {
        console.warn('Failed to prefetch lookups:', err);
      }
    };
    loadLookups();
  }, []);

  const loadTableData = async (tableKey: ConfigTableKey, isManualRefresh = false) => {
    if (tableKey === 'Rollover') return;

    const cacheKey = `config:${tableKey}`;
    const cached = getCachedData<any[]>(cacheKey);

    // Immediately isolate data: show cached data instantly (0ms) or clear stale previous tab data
    if (cached && !isManualRefresh) {
      setRecords(cached);
      setIsLoading(false);
      setIsRevalidating(true);
    } else {
      setRecords([]);
      setIsLoading(true);
      setIsRevalidating(false);
    }

    try {
      await fetchWithSwr(
        cacheKey,
        async () => {
          const res = await apiRequest('config:getTable', { table: tableKey });
          const rawRows: any[] = res.records || [];
          // Clean & filter rows: prune ghost empty rows from Google Sheets (rows with no ID / Record_ID / Year)
          const validRows = rawRows.filter(r => {
            if (!r || typeof r !== 'object') return false;
            const primaryVal = r[currentTabDef.idField] ?? r.ID ?? r.Record_ID ?? r.Year ?? r.Unit;
            return primaryVal !== undefined && primaryVal !== null && String(primaryVal).trim() !== '';
          });
          return validRows;
        },
        (data, isInitialCache) => {
          // Strict race-condition guard: discard if user already navigated to another tab
          if (activeTabRef.current !== tableKey) {
            return;
          }

          setRecords(data);
          if (isInitialCache) {
            setIsLoading(false);
            setIsRevalidating(true);
          } else {
            setIsLoading(false);
            setIsRevalidating(false);
          }
        }
      );
    } catch (err) {
      console.error(`Failed to load ${tableKey}:`, err);
    } finally {
      if (activeTabRef.current === tableKey) {
        setIsLoading(false);
        setIsRevalidating(false);
      }
    }
  };

  useEffect(() => {
    setSearch('');
    if (activeTab !== 'Rollover') {
      loadTableData(activeTab);
    } else {
      setRecords([]);
      setIsLoading(false);
      setIsRevalidating(false);
    }
  }, [activeTab]);

  // Open Form for Editing
  const handleEditRecord = (record: any) => {
    const clone = { ...record };
    setEditFormData(clone);
    setIsCreatingNew(false);
    setIsAdvancedSectionExpanded(false);

    // Parse Properties for Item Masterlist
    if (activeTab === 'Item') {
      let pairs: { key: string; value: string }[] = [];
      const propVal = clone.Properties;
      if (propVal) {
        try {
          const parsed = typeof propVal === 'string' ? JSON.parse(propVal) : propVal;
          if (typeof parsed === 'object' && parsed !== null) {
            pairs = Object.entries(parsed).map(([k, v]) => ({ key: k, value: String(v) }));
          }
        } catch {
          pairs = [];
        }
      }
      setItemPropertiesPairs(pairs);
    }

    setIsEditing(true);
  };

  // Open Form for Creating
  const handleCreateNew = () => {
    const defaultData: Record<string, any> = { Status: 'ACTIVE', Is_Active: true };
    if (activeTab === 'Item') {
      defaultData.Inventory_Type_Code = 'CNS';
      defaultData.Category_ID = 'PLB';
      defaultData.System = 'Plumbing & Sanitary';
      defaultData.Component = 'Piping Network';
      defaultData.UOM = 'pc';
      defaultData.Properties = '{}';
      setItemPropertiesPairs([]);
    }
    setEditFormData(defaultData);
    setIsCreatingNew(true);
    setIsAdvancedSectionExpanded(false);
    setIsEditing(true);
  };

  // Helper to compute Property Fingerprint live
  const computeItemFingerprint = (data: Record<string, any>) => {
    const cat = (data.Category_ID || 'GEN').toUpperCase().trim();
    const brand = (data.Brand || 'GEN').toUpperCase().trim();
    const model = (data.Model || 'GEN').toUpperCase().trim();
    const variant = (data.Variant || 'STD').toUpperCase().trim();
    return `${cat}|${brand}|${model}|${variant}`.replace(/\s+/g, '_');
  };

  // Helper to compute Item SKU live
  const computeItemSku = (data: Record<string, any>) => {
    if (data.SKU && !isCreatingNew) return data.SKU;
    const type = data.Inventory_Type_Code || 'CNS';
    const cat = data.Category_ID || 'PLB';
    const id = data.ID ? String(data.ID).replace(/^ITM-/, '') : '####';
    return `${type}-${cat}-${id}`;
  };

  // Trigger Save with Confirmation
  const promptSaveConfirmation = () => {
    const payloadData = { ...editFormData };

    // If active tab is Item, serialize interactive properties pairs into JSON string
    if (activeTab === 'Item') {
      const obj: Record<string, string> = {};
      itemPropertiesPairs.forEach(p => {
        if (p.key.trim()) {
          obj[p.key.trim()] = p.value.trim();
        }
      });
      payloadData.Properties = JSON.stringify(obj);

      // Auto update surrogate keys
      if (!payloadData.Property_Fingerprint) {
        payloadData.Property_Fingerprint = computeItemFingerprint(payloadData);
      }
      if (!payloadData.SKU) {
        payloadData.SKU = computeItemSku(payloadData);
      }
      if (!payloadData.Search_Tags && payloadData.Name) {
        payloadData.Search_Tags = `${payloadData.Name}, ${payloadData.Brand || ''}, ${payloadData.Model || ''}`.toLowerCase();
      }
    }

    const idVal = payloadData[currentTabDef.idField] || 'New';
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
            record: payloadData
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
          {
            key: 'SKU',
            label: 'Item SKU',
            align: 'left',
            minWidth: '130px',
            sortable: true,
            render: (r) => <span className="font-monospace fw-semibold text-dark">{r.SKU || r.ID}</span>
          },
          {
            key: 'Name',
            label: 'Product Information',
            align: 'left',
            minWidth: '240px',
            sortable: true,
            render: (r) => {
              const subtitleParts = [r.Brand, r.Model ? `• ${r.Model}` : null, r.Variant ? `(${r.Variant})` : null].filter(Boolean);
              return (
                <div>
                  <div className="fw-medium text-dark">{r.Name || '—'}</div>
                  {subtitleParts.length > 0 && (
                    <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                      {subtitleParts.join(' ')}
                    </div>
                  )}
                </div>
              );
            }
          },
          {
            key: 'UOM',
            label: 'Unit of Measurement',
            align: 'center',
            minWidth: '130px',
            sortable: true,
            render: (r) => (
              <span className="badge bg-light text-dark border font-monospace px-2 py-1">
                {r.UOM || '—'}
              </span>
            )
          },
          {
            key: 'Category_Name',
            label: 'Product Category',
            align: 'left',
            minWidth: '190px',
            sortable: true,
            render: (r) => (
              <div className="d-flex align-items-center gap-1 flex-wrap">
                <span className="fw-medium text-dark">{r.Category_Name || r.Category_ID || '—'}</span>
                {r.Inventory_Type_Code && (
                  <span className="badge bg-secondary-subtle text-secondary border px-1" style={{ fontSize: '0.7rem' }}>
                    {r.Inventory_Type_Code}
                  </span>
                )}
              </div>
            )
          },
          {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            minWidth: isHeadAdmin ? '110px' : '60px',
            render: (r) => (
              <div className="d-flex justify-content-end align-items-center gap-1">
                <button
                  type="button"
                  className="btn-icon-action action-view"
                  onClick={() => {
                    setIsPropertiesExpanded(false);
                    setViewingItem(r);
                  }}
                  title="View specification details"
                  aria-label="View specification details"
                >
                  <i className="bi bi-eye"></i>
                </button>
                {isHeadAdmin && (
                  <>
                    <button
                      type="button"
                      className="btn-icon-action action-edit"
                      onClick={() => handleEditRecord(r)}
                      title="Edit record"
                      aria-label="Edit record"
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button
                      type="button"
                      className="btn-icon-action action-delete"
                      onClick={() => promptDeleteConfirmation(r)}
                      title="Archive record"
                      aria-label="Archive record"
                    >
                      <i className="bi bi-archive"></i>
                    </button>
                  </>
                )}
              </div>
            )
          }
        ];

      case 'Supplier':
        return [
          { key: 'ID', label: 'Supplier ID', align: 'left', minWidth: '110px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.ID || r.Supplier_ID}</span> },
          { key: 'Name', label: 'Supplier Name', align: 'left', minWidth: '220px', sortable: true, render: (r) => <span className="fw-medium text-dark">{r.Name || r.Supplier_Name}</span> },
          { key: 'Contact_Person', label: 'Contact Person', align: 'left', minWidth: '160px', sortable: true, render: (r) => r.Contact_Person || '—' },
          { key: 'Phone', label: 'Phone', align: 'left', minWidth: '130px', render: (r) => r.Phone || r.Contact_Number || '—' },
          { key: 'Email', label: 'Email Address', align: 'left', minWidth: '180px', render: (r) => r.Email || '—' },
          { key: 'Status', label: 'Status', align: 'center', minWidth: '85px', sortable: true, render: (r) => <span className={`badge ${r.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Status || 'ACTIVE'}</span> },
          ...(isHeadAdmin ? [{
            key: 'actions', label: 'Actions', align: 'right' as const, minWidth: '90px', render: (r: any) => (
              <div className="d-flex justify-content-end align-items-center gap-1">
                <button type="button" className="btn-icon-action action-edit" title="Edit record" aria-label="Edit record" onClick={() => handleEditRecord(r)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button type="button" className="btn-icon-action action-delete" title="Archive record" aria-label="Archive record" onClick={() => promptDeleteConfirmation(r)}>
                  <i className="bi bi-archive"></i>
                </button>
              </div>
            )
          }] : [])
        ];

      case 'Item_Supplier_and_Pricing':
        return [
          { key: 'Record_ID', label: 'Record ID', align: 'left', minWidth: '110px', sortable: true, render: (r) => <span className="font-monospace text-muted">{r.Record_ID || r.Mapping_ID}</span> },
          {
            key: 'Item_Name',
            label: 'Item',
            align: 'left',
            minWidth: '220px',
            sortable: true,
            render: (r) => (
              <div>
                <span className="fw-medium text-dark">{r.Item_Name || '—'}</span>
                {r.Item_ID && <span className="text-muted small font-monospace ms-1">({r.Item_ID})</span>}
              </div>
            )
          },
          {
            key: 'Supplier_Name',
            label: 'Supplier',
            align: 'left',
            minWidth: '200px',
            sortable: true,
            render: (r) => (
              <div>
                <span>{r.Supplier_Name || '—'}</span>
                {r.Supplier_ID && <span className="text-muted small font-monospace ms-1">({r.Supplier_ID})</span>}
              </div>
            )
          },
          {
            key: 'Price_per_Unit',
            label: 'Price per Unit',
            align: 'right',
            minWidth: '120px',
            sortable: true,
            render: (r) => <span className="font-monospace small">PHP {Number(r.Price_per_Unit || r.Price || 0).toFixed(2)}</span>
          },
          { key: 'UOM', label: 'UOM', align: 'center', minWidth: '80px', sortable: true, render: (r) => r.UOM || '—' },
          {
            key: 'Discount_Percentage',
            label: 'Discount',
            align: 'right',
            minWidth: '95px',
            render: (r) => r.Discount_Percentage !== undefined && r.Discount_Percentage !== null ? `${r.Discount_Percentage}%` : '—'
          },
          {
            key: 'Is_Preferred',
            label: 'Preferred',
            align: 'center',
            minWidth: '90px',
            render: (r) => {
              const isPref = r.Is_Preferred === true || String(r.Is_Preferred).toUpperCase() === 'TRUE';
              return isPref ? <span className="badge bg-primary-subtle text-primary border">Yes</span> : <span className="text-muted small">No</span>;
            }
          },
          ...(isHeadAdmin ? [{
            key: 'actions', label: 'Actions', align: 'right' as const, minWidth: '90px', render: (r: any) => (
              <div className="d-flex justify-content-end align-items-center gap-1">
                <button type="button" className="btn-icon-action action-edit" title="Edit record" aria-label="Edit record" onClick={() => handleEditRecord(r)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button type="button" className="btn-icon-action action-delete" title="Archive record" aria-label="Archive record" onClick={() => promptDeleteConfirmation(r)}>
                  <i className="bi bi-archive"></i>
                </button>
              </div>
            )
          }] : [])
        ];

      case 'Inventory_Category':
        return [
          { key: 'ID', label: 'Trade Code', align: 'left', minWidth: '110px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.ID || r.Category_ID}</span> },
          { key: 'SKU_Prefix', label: 'SKU Prefix', align: 'left', minWidth: '100px', sortable: true, render: (r) => <span className="font-monospace text-muted">{r.SKU_Prefix || r.ID}</span> },
          { key: 'Name', label: 'Category Name', align: 'left', minWidth: '200px', sortable: true, render: (r) => <span className="fw-medium text-dark">{r.Name || r.Category_Name}</span> },
          { key: 'Description', label: 'Description', align: 'left', minWidth: '260px', render: (r) => r.Description || '—' },
          ...(isHeadAdmin ? [{
            key: 'actions', label: 'Actions', align: 'right' as const, minWidth: '90px', render: (r: any) => (
              <div className="d-flex justify-content-end align-items-center gap-1">
                <button type="button" className="btn-icon-action action-edit" title="Edit record" aria-label="Edit record" onClick={() => handleEditRecord(r)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button type="button" className="btn-icon-action action-delete" title="Archive record" aria-label="Archive record" onClick={() => promptDeleteConfirmation(r)}>
                  <i className="bi bi-archive"></i>
                </button>
              </div>
            )
          }] : [])
        ];

      case 'UOM':
        return [
          { key: 'Unit', label: 'Unit Symbol', align: 'left', minWidth: '100px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.Unit || r.ID || r.UOM_Code}</span> },
          { key: 'Name', label: 'Unit Name', align: 'left', minWidth: '180px', sortable: true, render: (r) => <span className="fw-medium text-dark">{r.Name || r.UOM_Name}</span> },
          { key: 'Category', label: 'Dimension Category', align: 'left', minWidth: '160px', sortable: true, render: (r) => r.Category || r.UOM_Category_ID || '—' },
          { key: 'Description', label: 'Description', align: 'left', minWidth: '240px', render: (r) => r.Description || '—' },
          ...(isHeadAdmin ? [{
            key: 'actions', label: 'Actions', align: 'right' as const, minWidth: '90px', render: (r: any) => (
              <div className="d-flex justify-content-end align-items-center gap-1">
                <button type="button" className="btn-icon-action action-edit" title="Edit record" aria-label="Edit record" onClick={() => handleEditRecord(r)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button type="button" className="btn-icon-action action-delete" title="Archive record" aria-label="Archive record" onClick={() => promptDeleteConfirmation(r)}>
                  <i className="bi bi-archive"></i>
                </button>
              </div>
            )
          }] : [])
        ];

      case 'UOM_Category':
        return [
          { key: 'ID', label: 'Category ID', align: 'left', minWidth: '130px', sortable: true, render: (r) => <span className="font-monospace fw-semibold text-dark">{r.ID || r.UOM_Category_ID}</span> },
          { key: 'Name', label: 'Category Name', align: 'left', minWidth: '180px', sortable: true, render: (r) => <span className="fw-medium text-dark">{r.Name || r.UOM_Category_Name}</span> },
          { key: 'Description', label: 'Description', align: 'left', minWidth: '260px', render: (r) => r.Description || '—' },
          ...(isHeadAdmin ? [{
            key: 'actions', label: 'Actions', align: 'right' as const, minWidth: '90px', render: (r: any) => (
              <div className="d-flex justify-content-end align-items-center gap-1">
                <button type="button" className="btn-icon-action action-edit" title="Edit record" aria-label="Edit record" onClick={() => handleEditRecord(r)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button type="button" className="btn-icon-action action-delete" title="Archive record" aria-label="Archive record" onClick={() => promptDeleteConfirmation(r)}>
                  <i className="bi bi-archive"></i>
                </button>
              </div>
            )
          }] : [])
        ];

      case 'Warehouse_Location':
        return [
          { key: 'ID', label: 'Location ID', align: 'left', minWidth: '180px', sortable: true, render: (r) => <span className="font-monospace text-dark fw-semibold small">{r.ID || r.Location_ID}</span> },
          { key: 'Name', label: 'Location Name', align: 'left', minWidth: '220px', sortable: true, render: (r) => <span className="fw-medium text-dark">{r.Name || r.Location_Name}</span> },
          { key: 'Description', label: 'Description', align: 'left', minWidth: '280px', render: (r) => r.Description || '—' },
          ...(isHeadAdmin ? [{
            key: 'actions', label: 'Actions', align: 'right' as const, minWidth: '90px', render: (r: any) => (
              <div className="d-flex justify-content-end align-items-center gap-1">
                <button type="button" className="btn-icon-action action-edit" title="Edit record" aria-label="Edit record" onClick={() => handleEditRecord(r)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button type="button" className="btn-icon-action action-delete" title="Archive record" aria-label="Archive record" onClick={() => promptDeleteConfirmation(r)}>
                  <i className="bi bi-archive"></i>
                </button>
              </div>
            )
          }] : [])
        ];

      case 'Sheet_Records':
        return [
          { key: 'Year', label: 'Fiscal Year', align: 'left', minWidth: '110px', sortable: true, render: (r) => <span className="fw-bold text-dark">{r.Year}</span> },
          { key: 'Sheet_ID', label: 'Spreadsheet ID', align: 'left', minWidth: '240px', render: (r) => <span className="font-monospace text-muted small">{r.Sheet_ID || r.Spreadsheet_ID}</span> },
          {
            key: 'Sheet_URL',
            label: 'Spreadsheet Link',
            align: 'left',
            minWidth: '200px',
            render: (r) => {
              const url = r.Sheet_URL || (r.Sheet_ID ? `https://docs.google.com/spreadsheets/d/${r.Sheet_ID}` : null);
              if (!url) return <span className="text-muted small">—</span>;
              return (
                <a href={url} target="_blank" rel="noopener noreferrer" className="small text-primary text-decoration-none">
                  Open Google Sheet <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: '0.75rem' }}></i>
                </a>
              );
            }
          },
          { key: 'Status', label: 'Status', align: 'center', minWidth: '95px', sortable: true, render: (r) => <span className={`badge ${r.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>{r.Status || 'ACTIVE'}</span> },
          { key: 'Created_At', label: 'Registered Date', align: 'left', minWidth: '140px', render: (r) => <span className="small text-muted">{r.Created_At || '—'}</span> },
          ...(isHeadAdmin ? [{
            key: 'actions', label: 'Actions', align: 'right' as const, minWidth: '90px', render: (r: any) => (
              <div className="d-flex justify-content-end align-items-center gap-1">
                <button type="button" className="btn-icon-action action-edit" title="Edit record" aria-label="Edit record" onClick={() => handleEditRecord(r)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button type="button" className="btn-icon-action action-delete" title="Archive record" aria-label="Archive record" onClick={() => promptDeleteConfirmation(r)}>
                  <i className="bi bi-archive"></i>
                </button>
              </div>
            )
          }] : [])
        ];

      case 'Rollover':
      default:
        return [];
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

        {activeTab !== 'Rollover' && isHeadAdmin && (
          <button className="btn btn-primary btn-sm" onClick={handleCreateNew}>
            <i className="bi bi-plus-lg me-1"></i> Add {currentTabDef.label.slice(0, -1) || 'Record'}
          </button>
        )}
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
                isActive ? 'text-primary fw-semibold' : 'text-secondary'
              }`}
              style={{
                fontSize: '0.875rem',
                borderBottom: isActive ? '2px solid var(--bs-primary, #184421)' : '2px solid transparent',
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

      {/* Tab Context Subtitle & Toolbar */}
      {activeTab !== 'Rollover' && (
        <div className="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="small text-muted">
            Managing <strong>{currentTabDef.key}</strong>: {currentTabDef.description}
            {!isHeadAdmin && (
              <span className="badge bg-light text-muted border ms-2">
                <i className="bi bi-eye me-1"></i>Read-Only Access
              </span>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            {activeTab === 'Sheet_Records' && isHeadAdmin && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm py-0 px-2"
                style={{ height: '28px' }}
                onClick={() => setActiveTab('Rollover')}
              >
                <i className="bi bi-arrow-repeat me-1"></i> Launch Rollover Wizard
              </button>
            )}
            <button
              className="btn btn-link btn-sm text-decoration-none text-muted py-0"
              onClick={() => {
                invalidateCache(`config:${activeTab}`);
                loadTableData(activeTab, true);
              }}
              disabled={isLoading || isRevalidating}
              title={isRevalidating ? 'Synchronizing fresh data in background' : 'Force re-fetch from database'}
            >
              <i className={`bi bi-arrow-clockwise me-1 ${isRevalidating ? 'spin-animation' : ''}`}></i>
              {isRevalidating ? 'Syncing...' : isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      )}

      {/* Content View: Rollover Wizard or Master Registry DataTable */}
      {activeTab === 'Rollover' ? (
        <RolloverWizard />
      ) : (
        <DataTable
          columns={getColumnsForTab(activeTab)}
          data={filteredRecords}
          keyField={currentTabDef.idField}
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder={`Filter ${currentTabDef.label}...`}
          emptyMessage={`No ${currentTabDef.label} records found.`}
          isLoading={isLoading}
        />
      )}

      {/* View Item Specifications Modal */}
      {viewingItem && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1055 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border shadow-sm">
              {/* Modal Header: SKU removed as requested */}
              <div className="modal-header py-3 px-4 bg-light border-bottom">
                <h6 className="modal-title fw-bold text-dark mb-0">Item Specification Details</h6>
                <button type="button" className="btn-close" onClick={() => setViewingItem(null)}></button>
              </div>

              <div className="modal-body p-4">
                {/* Section 1: Item Information (Flush List Group) */}
                <div className="mb-4">
                  <div className="text-uppercase text-muted fw-bold mb-2 small" style={{ fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                    Item Information
                  </div>
                  <ul className="list-group list-group-flush border rounded-2 overflow-hidden">
                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                      <span className="text-muted small">Item SKU</span>
                      <span className="font-monospace fw-semibold text-dark">{viewingItem.SKU || viewingItem.ID || '—'}</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                      <span className="text-muted small">Product Name</span>
                      <span className="fw-medium text-dark text-end">{viewingItem.Name || '—'}</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                      <span className="text-muted small">Brand & Model</span>
                      <span className="text-dark text-end">
                        {viewingItem.Brand || '—'} {viewingItem.Model ? `• ${viewingItem.Model}` : ''}
                      </span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                      <span className="text-muted small">Variant</span>
                      <span className="text-dark">{viewingItem.Variant || 'Standard'}</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                      <span className="text-muted small">Unit of Measurement (UOM)</span>
                      <span className="badge bg-light text-dark border font-monospace px-2">{viewingItem.UOM || '—'}</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                      <span className="text-muted small">Status</span>
                      <span className={`badge ${viewingItem.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>
                        {viewingItem.Status || 'ACTIVE'}
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Section 2: Product Category & Classification (Flush List Group) */}
                <div className="mb-4">
                  <div className="text-uppercase text-muted fw-bold mb-2 small" style={{ fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                    Category & Classification
                  </div>
                  <ul className="list-group list-group-flush border rounded-2 overflow-hidden">
                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                      <span className="text-muted small">Product Category</span>
                      <span className="fw-medium text-dark">{viewingItem.Category_Name || viewingItem.Category_ID || '—'}</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                      <span className="text-muted small">Inventory Type Code</span>
                      <span className="badge bg-secondary-subtle text-secondary border font-monospace">{viewingItem.Inventory_Type_Code || '—'}</span>
                    </li>
                    {viewingItem.System && (
                      <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                        <span className="text-muted small">System Classification</span>
                        <span className="text-dark">{viewingItem.System}</span>
                      </li>
                    )}
                    {viewingItem.Component && (
                      <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                        <span className="text-muted small">Component / Machinery</span>
                        <span className="text-dark">{viewingItem.Component}</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Section 3: Collapsible Properties (Collapsed by default) */}
                <div className="mb-3">
                  <div className="border rounded-2 overflow-hidden">
                    <button
                      type="button"
                      className="w-100 btn btn-light text-start py-2 px-3 d-flex justify-content-between align-items-center border-0 rounded-0"
                      onClick={() => setIsPropertiesExpanded(!isPropertiesExpanded)}
                    >
                      <span className="fw-semibold text-dark small">
                        <i className="bi bi-sliders me-2 text-primary"></i>Properties
                      </span>
                      <i className={`bi bi-chevron-down text-muted small transition-all ${isPropertiesExpanded ? 'rotate-180' : ''}`}></i>
                    </button>

                    {isPropertiesExpanded && (
                      <div className="p-3 border-top bg-white">
                        {(() => {
                          let parsedProps: Record<string, any> = {};
                          if (viewingItem.Properties) {
                            try {
                              parsedProps = typeof viewingItem.Properties === 'string'
                                ? JSON.parse(viewingItem.Properties)
                                : viewingItem.Properties;
                            } catch {
                              parsedProps = {};
                            }
                          }
                          const propKeys = Object.keys(parsedProps);
                          if (propKeys.length === 0) {
                            return <div className="text-muted small fst-italic">No custom properties defined for this item.</div>;
                          }
                          return (
                            <ul className="list-group list-group-flush mb-0">
                              {propKeys.map(key => (
                                <li key={key} className="list-group-item d-flex justify-content-between align-items-center py-2 px-0">
                                  <span className="text-muted small">{key.replace(/_/g, ' ')}</span>
                                  <span className="fw-medium text-dark font-monospace small">{String(parsedProps[key])}</span>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Technical Identifiers (Subdued) */}
                {(viewingItem.Property_Fingerprint || viewingItem.Search_Tags) && (
                  <div className="p-3 bg-light rounded-2 border small">
                    {viewingItem.Property_Fingerprint && (
                      <div className="mb-2">
                        <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Property Fingerprint:</span>
                        <code className="text-dark font-monospace">{viewingItem.Property_Fingerprint}</code>
                      </div>
                    )}
                    {viewingItem.Search_Tags && (
                      <div>
                        <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Search Tags:</span>
                        <span className="text-secondary">{viewingItem.Search_Tags}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer py-2 px-4 bg-light border-top d-flex justify-content-between align-items-center">
                {isHeadAdmin ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      const itemToEdit = viewingItem;
                      setViewingItem(null);
                      handleEditRecord(itemToEdit);
                    }}
                  >
                    <i className="bi bi-pencil me-1"></i> Edit Specification
                  </button>
                ) : (
                  <div></div>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setViewingItem(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Modal Form */}
      {isEditing && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1055 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border shadow-sm">
              <div className="modal-header py-3 px-4 bg-light border-bottom">
                <h6 className="modal-title fw-bold text-dark mb-0">
                  {isCreatingNew ? `Create New ${currentTabDef.label.slice(0, -1)}` : `Edit ${currentTabDef.label.slice(0, -1)}`}
                </h6>
                <button type="button" className="btn-close" onClick={() => setIsEditing(false)}></button>
              </div>

              <div className="modal-body p-4">
                {/* Specialized Sectioned Layout for Item Masterlist */}
                {activeTab === 'Item' ? (
                  <div className="d-flex flex-column gap-4">
                    {/* Section 1: Product Information */}
                    <div>
                      <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                        <h6 className="fw-bold text-dark mb-0">
                          <i className="bi bi-box me-2 text-primary"></i>Product Information
                        </h6>
                        {/* Live Item SKU Preview */}
                        <div className="d-flex align-items-center gap-1">
                          <span className="small text-muted">SKU:</span>
                          <span className="badge bg-light text-dark border font-monospace">
                            {computeItemSku(editFormData)}
                          </span>
                        </div>
                      </div>

                      <div className="row g-3">
                        <div className="col-12">
                          <label className="form-label small text-muted mb-1">Item Name *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. PPR Pipe 1/2in x 4m"
                            value={editFormData.Name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, Name: e.target.value })}
                          />
                        </div>

                        <div className="col-12 col-md-4">
                          <label className="form-label small text-muted mb-1">Brand</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Pipelife"
                            value={editFormData.Brand || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, Brand: e.target.value })}
                          />
                        </div>

                        <div className="col-12 col-md-4">
                          <label className="form-label small text-muted mb-1">Model</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. PN20"
                            value={editFormData.Model || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, Model: e.target.value })}
                          />
                        </div>

                        <div className="col-12 col-md-4">
                          <label className="form-label small text-muted mb-1">Variant</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Green / Hot & Cold"
                            value={editFormData.Variant || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, Variant: e.target.value })}
                          />
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label small text-muted mb-1">Unit of Measurement (UOM) *</label>
                          <select
                            className="form-select form-select-sm"
                            value={editFormData.UOM || 'pc'}
                            onChange={(e) => setEditFormData({ ...editFormData, UOM: e.target.value })}
                          >
                            {lookupUoms.length > 0 ? (
                              lookupUoms.map((u: any) => (
                                <option key={u.Unit || u.ID} value={u.Unit || u.ID}>
                                  {u.Unit || u.ID} — {u.Name}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="pc">pc — Piece</option>
                                <option value="box">box — Box</option>
                                <option value="mtr">mtr — Meter</option>
                                <option value="set">set — Set / Kit</option>
                                <option value="cyl">cyl — Cylinder</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Interactive Properties Key-Value Pair Editor */}
                      <div className="mt-3 p-3 bg-light rounded-2 border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <label className="form-label small fw-semibold text-dark mb-0">
                            <i className="bi bi-tags me-1 text-primary"></i>Properties (Key-Value Specifications)
                          </label>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm py-0 px-2"
                            style={{ fontSize: '0.75rem', height: '24px' }}
                            onClick={() => setItemPropertiesPairs([...itemPropertiesPairs, { key: '', value: '' }])}
                          >
                            <i className="bi bi-plus me-1"></i>Add Property
                          </button>
                        </div>

                        {itemPropertiesPairs.length === 0 ? (
                          <div className="text-muted small fst-italic py-1">
                            No custom technical properties added. Click "Add Property" to attach specifications (e.g. pressure_rating, voltage, size).
                          </div>
                        ) : (
                          <div className="d-flex flex-column gap-2 mt-2">
                            {itemPropertiesPairs.map((pair, idx) => (
                              <div key={idx} className="d-flex align-items-center gap-2">
                                <input
                                  type="text"
                                  className="form-control form-control-sm font-monospace"
                                  placeholder="Property Key (e.g. diameter)"
                                  style={{ maxWidth: '200px' }}
                                  value={pair.key}
                                  onChange={(e) => {
                                    const next = [...itemPropertiesPairs];
                                    next[idx].key = e.target.value;
                                    setItemPropertiesPairs(next);
                                  }}
                                />
                                <span className="text-muted">:</span>
                                <input
                                  type="text"
                                  className="form-control form-control-sm flex-grow-1"
                                  placeholder="Value (e.g. 1/2in)"
                                  value={pair.value}
                                  onChange={(e) => {
                                    const next = [...itemPropertiesPairs];
                                    next[idx].value = e.target.value;
                                    setItemPropertiesPairs(next);
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn-icon-action action-delete"
                                  title="Remove property"
                                  onClick={() => setItemPropertiesPairs(itemPropertiesPairs.filter((_, i) => i !== idx))}
                                >
                                  <i className="bi bi-trash3"></i>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Product Category & System */}
                    <div>
                      <div className="mb-3 border-bottom pb-2">
                        <h6 className="fw-bold text-dark mb-0">
                          <i className="bi bi-diagram-3 me-2 text-primary"></i>Product Category & Hierarchy
                        </h6>
                      </div>

                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label small text-muted mb-1">System (Engineering Domain) *</label>
                          <select
                            className="form-select form-select-sm"
                            value={editFormData.System || 'Plumbing & Sanitary'}
                            onChange={(e) => setEditFormData({ ...editFormData, System: e.target.value })}
                          >
                            <option value="Plumbing & Sanitary">Plumbing & Sanitary</option>
                            <option value="Electrical & Power">Electrical & Power</option>
                            <option value="HVAC & Refrigeration">HVAC & Refrigeration</option>
                            <option value="Fire Protection">Fire Protection</option>
                            <option value="Lifting System">Lifting System</option>
                            <option value="Civil & Architectural">Civil & Architectural</option>
                            <option value="Auxiliary & IT">Auxiliary & IT</option>
                          </select>
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label small text-muted mb-1">Component / Subsystem *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Piping Network, Air Handling Unit"
                            value={editFormData.Component || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, Component: e.target.value })}
                          />
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label small text-muted mb-1">Inventory Category (Trade) *</label>
                          <select
                            className="form-select form-select-sm"
                            value={editFormData.Category_ID || 'PLB'}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const matched = lookupCategories.find(c => (c.ID || c.Category_ID) === selectedId);
                              setEditFormData({
                                ...editFormData,
                                Category_ID: selectedId,
                                Category_Name: matched ? (matched.Name || matched.Category_Name) : editFormData.Category_Name
                              });
                            }}
                          >
                            {lookupCategories.length > 0 ? (
                              lookupCategories.map((c: any) => (
                                <option key={c.ID || c.Category_ID} value={c.ID || c.Category_ID}>
                                  {c.ID || c.Category_ID} — {c.Name || c.Category_Name}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="PLB">PLB — Plumbing Supplies</option>
                                <option value="ELE">ELE — Electrical Supplies</option>
                                <option value="HVA">HVA — HVAC & Refrigeration</option>
                                <option value="CIV">CIV — Civil & Masonry</option>
                                <option value="PWR">PWR — Power Tools</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label small text-muted mb-1">Inventory Type *</label>
                          <select
                            className="form-select form-select-sm"
                            value={editFormData.Inventory_Type_Code || 'CNS'}
                            onChange={(e) => setEditFormData({ ...editFormData, Inventory_Type_Code: e.target.value })}
                          >
                            {lookupTypes.length > 0 ? (
                              lookupTypes.map((t: any) => (
                                <option key={t.ID || t.code} value={t.ID || t.code}>
                                  {t.ID || t.code} — {t.Name || t.name}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="CNS">CNS — Consumables</option>
                                <option value="TLS">TLS — Tools & Equipment</option>
                                <option value="SPR">SPR — Spare Parts</option>
                                <option value="MSC">MSC — Miscellaneous</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Advanced (Collapsible, Collapsed by Default) */}
                    <div className="border rounded-2 overflow-hidden">
                      <button
                        type="button"
                        className="w-100 btn btn-light text-start py-2 px-3 d-flex justify-content-between align-items-center border-0 rounded-0"
                        onClick={() => setIsAdvancedSectionExpanded(!isAdvancedSectionExpanded)}
                      >
                        <span className="fw-semibold text-dark small">
                          <i className="bi bi-gear me-2 text-secondary"></i>Advanced Identifiers & Metadata
                        </span>
                        <i className={`bi bi-chevron-down text-muted small transition-all ${isAdvancedSectionExpanded ? 'rotate-180' : ''}`}></i>
                      </button>

                      {isAdvancedSectionExpanded && (
                        <div className="p-3 border-top bg-white">
                          <div className="row g-3">
                            <div className="col-12 col-md-6">
                              <label className="form-label small text-muted mb-1">Item ID (PK)</label>
                              <input
                                type="text"
                                className="form-control form-control-sm font-monospace"
                                disabled={!isCreatingNew}
                                value={editFormData.ID || ''}
                                placeholder="Auto-generated (e.g. ITM-0001)"
                                onChange={(e) => setEditFormData({ ...editFormData, ID: e.target.value })}
                              />
                            </div>

                            <div className="col-12 col-md-6">
                              <label className="form-label small text-muted mb-1">Status</label>
                              <select
                                className="form-select form-select-sm"
                                value={editFormData.Status || 'ACTIVE'}
                                onChange={(e) => setEditFormData({ ...editFormData, Status: e.target.value })}
                              >
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="INACTIVE">INACTIVE</option>
                                <option value="DISCONTINUED">DISCONTINUED</option>
                                <option value="PHASED_OUT">PHASED_OUT</option>
                              </select>
                            </div>

                            <div className="col-12">
                              <label className="form-label small text-muted mb-1">Property Fingerprint (Surrogate Key)</label>
                              <input
                                type="text"
                                className="form-control form-control-sm font-monospace"
                                value={editFormData.Property_Fingerprint || computeItemFingerprint(editFormData)}
                                onChange={(e) => setEditFormData({ ...editFormData, Property_Fingerprint: e.target.value })}
                              />
                            </div>

                            <div className="col-12">
                              <label className="form-label small text-muted mb-1">Search Tags (Comma-separated)</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="ppr, pipe, water, plumbing"
                                value={editFormData.Search_Tags || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, Search_Tags: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Standard Dynamic Form for other Configuration tabs */
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
                )}
              </div>

              <div className="modal-footer py-2 px-4 bg-light border-top d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={promptSaveConfirmation}>
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
