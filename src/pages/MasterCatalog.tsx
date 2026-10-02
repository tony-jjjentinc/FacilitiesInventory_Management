import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { fetchWithSwr, invalidateCache } from '../services/cache';
import type { InventoryTypeCode } from '../types';
import { DataTable, type Column } from '../components/DataTable';

interface RawCatalogItem {
  ID: string;
  SKU: string;
  Name: string;
  Brand: string;
  Model: string;
  Variant: string;
  Properties: string;
  Property_Fingerprint?: string;
  Search_Tags?: string;
  System: string;
  Component: string;
  UOM: string;
  Inventory_Type_Code: InventoryTypeCode;
  Category_ID: string;
  Category_Name: string;
  Status: string;
}

const CATEGORIES = [
  { id: 'PLB', name: 'Plumbing' },
  { id: 'ELE', name: 'Electrical' },
  { id: 'HVA', name: 'HVAC & Refrigeration' },
  { id: 'CIV', name: 'Civil & Masonry' },
  { id: 'PNT', name: 'Paints & Finishes' },
  { id: 'HDW', name: 'General Hardware' },
  { id: 'PWR', name: 'Power Tools' },
  { id: 'HND', name: 'Hand Tools' },
  { id: 'PPE', name: 'Safety & PPE' }
];

const INVENTORY_TYPES: { code: InventoryTypeCode; name: string }[] = [
  { code: 'CNS', name: 'Consumables (CNS)' },
  { code: 'TLS', name: 'Tools & Equipment (TLS)' },
  { code: 'SPR', name: 'Spare Parts (SPR)' },
  { code: 'MSC', name: 'Miscellaneous (MSC)' }
];

export const MasterCatalog: React.FC = () => {
  const [items, setItems] = useState<RawCatalogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    model: '',
    variant: '',
    categoryId: 'PLB',
    typeCode: 'CNS' as InventoryTypeCode,
    system: 'Plumbing and Sanitary System',
    component: 'Piping Network',
    uom: 'pc',
    propertiesJson: '{}'
  });
  const [lookupPropertyKeys, setLookupPropertyKeys] = useState<any[]>([]);
  const [propertiesPairs, setPropertiesPairs] = useState<{ key: string; value: string }[]>([]);

  const loadItems = async () => {
    try {
      await fetchWithSwr<RawCatalogItem[]>(
        'catalog:items',
        () => apiRequest<RawCatalogItem[]>('catalog:getItems'),
        (data) => {
          if (Array.isArray(data)) {
            setItems(data);
          }
        }
      );
    } catch (err) {
      console.error('Failed to load catalog items:', err);
    }
  };

  useEffect(() => {
    loadItems();
    apiRequest('config:getTable', { table: 'Inventory_Property_Keys' })
      .then(res => {
        if (res.records && Array.isArray(res.records)) {
          setLookupPropertyKeys(res.records);
        }
      })
      .catch(() => {});
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showModal]);

  const computedFingerprint = `${formData.categoryId}|${(formData.brand || 'GEN').toUpperCase().trim()}|${(formData.model || 'GEN').toUpperCase().trim()}|${(formData.variant || 'STD').toUpperCase().trim()}`.replace(/\s+/g, '_');

  const handleSaveItem = () => {
    const propsObj: Record<string, string> = {};
    propertiesPairs.forEach(p => {
      if (p.key.trim()) {
        propsObj[p.key.trim()] = p.value.trim();
      }
    });

    const newItem: RawCatalogItem = {
      ID: `ITM-${String(items.length + 1).padStart(4, '0')}`,
      SKU: `${formData.typeCode}-${formData.categoryId}-${String(items.length + 1).padStart(4, '0')}`,
      Name: formData.name,
      Brand: formData.brand,
      Model: formData.model,
      Variant: formData.variant,
      Properties: JSON.stringify(propsObj),
      Property_Fingerprint: computedFingerprint,
      Search_Tags: `${formData.name}, ${formData.brand}, ${formData.model}`.toLowerCase(),
      System: formData.system,
      Component: formData.component,
      UOM: formData.uom,
      Inventory_Type_Code: formData.typeCode,
      Category_ID: formData.categoryId,
      Category_Name: CATEGORIES.find(c => c.id === formData.categoryId)?.name || '',
      Status: 'ACTIVE'
    };

    invalidateCache('catalog:items');
    setItems([newItem, ...items]);
    setShowModal(false);
    setPropertiesPairs([]);
    setFormData({
      name: '',
      brand: '',
      model: '',
      variant: '',
      categoryId: 'PLB',
      typeCode: 'CNS',
      system: 'Plumbing and Sanitary System',
      component: 'Piping Network',
      uom: 'pc',
      propertiesJson: '{}'
    });
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = !categoryFilter || item.Category_ID === categoryFilter;
    const matchesType = !typeFilter || item.Inventory_Type_Code === typeFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      item.Name.toLowerCase().includes(query) ||
      item.SKU.toLowerCase().includes(query) ||
      (item.Brand && item.Brand.toLowerCase().includes(query)) ||
      (item.Search_Tags && item.Search_Tags.toLowerCase().includes(query));

    return matchesCategory && matchesType && matchesSearch;
  });

  const columns: Column<RawCatalogItem>[] = [
    {
      key: 'SKU',
      label: 'SKU',
      align: 'left',
      minWidth: '130px',
      sortable: true,
      render: (row) => <span className="font-monospace fw-semibold text-dark">{row.SKU}</span>
    },
    {
      key: 'Name',
      label: 'Item Name',
      align: 'left',
      minWidth: '220px',
      sortable: true,
      render: (row) => (
        <div>
          <div className="fw-medium text-dark">{row.Name}</div>
          {row.Brand || row.Model ? (
            <div className="text-muted small">
              {row.Brand} {row.Model ? `• ${row.Model}` : ''} {row.Variant ? `(${row.Variant})` : ''}
            </div>
          ) : null}
        </div>
      )
    },
    {
      key: 'Category_ID',
      label: 'Category',
      align: 'left',
      minWidth: '100px',
      sortable: true,
      render: (row) => (
        <span className="badge bg-light text-dark border">
          {row.Category_ID}
        </span>
      )
    },
    {
      key: 'Inventory_Type_Code',
      label: 'Type',
      align: 'left',
      minWidth: '90px',
      sortable: true,
      render: (row) => (
        <span className="text-muted small fw-medium">{row.Inventory_Type_Code}</span>
      )
    },
    {
      key: 'UOM',
      label: 'UOM',
      align: 'center',
      minWidth: '70px',
      sortable: true,
      render: (row) => <span className="small text-muted">{row.UOM}</span>
    },
    {
      key: 'System',
      label: 'System & Component',
      align: 'left',
      minWidth: '180px',
      sortable: true,
      render: (row) => (
        <div className="small">
          <div className="text-dark">{row.System || '—'}</div>
          <div className="text-muted">{row.Component || ''}</div>
        </div>
      )
    },
    {
      key: 'Property_Fingerprint',
      label: 'Fingerprint',
      align: 'left',
      minWidth: '180px',
      render: (row) => (
        <span className="font-monospace small text-muted text-truncate d-inline-block" style={{ maxWidth: '170px' }}>
          {row.Property_Fingerprint || '—'}
        </span>
      )
    },
    {
      key: 'Status',
      label: 'Status',
      align: 'center',
      minWidth: '85px',
      sortable: true,
      render: (row) => (
        <span className={`badge ${row.Status === 'ACTIVE' ? 'bg-success-subtle text-success border' : 'bg-secondary-subtle text-secondary border'}`}>
          {row.Status}
        </span>
      )
    }
  ];

  return (
    <div className="container py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Master Catalog</h4>
          <p className="text-muted small mb-0">
            Decoupled technical trade categories and physical inventory classifications.
          </p>
        </div>

        <button className="btn btn-dark btn-sm" onClick={() => setShowModal(true)}>
          Add Catalog Item
        </button>
      </div>

      {/* Minimal DataTable */}
      <DataTable
        columns={columns}
        data={filteredItems}
        keyField="ID"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Filter items by SKU, name, brand..."
        filters={
          <>
            <select
              className="form-select form-select-sm"
              style={{ width: '160px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
              ))}
            </select>

            <select
              className="form-select form-select-sm"
              style={{ width: '160px' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {INVENTORY_TYPES.map(t => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </>
        }
      />

      {/* Minimal Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header py-3 px-4 bg-light border-bottom">
                <h6 className="modal-title fw-bold text-dark mb-0">Create Catalog Item</h6>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Item Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. PPR Ball Valve 1 inch"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Trade Category</label>
                    <select
                      className="form-select form-select-sm"
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Inventory Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={formData.typeCode}
                      onChange={(e) => setFormData({ ...formData, typeCode: e.target.value as InventoryTypeCode })}
                    >
                      {INVENTORY_TYPES.map(t => (
                        <option key={t.code} value={t.code}>{t.code}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label small text-muted mb-1">Brand</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Amco"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>

                  <div className="col-6 col-md-4">
                    <label className="form-label small text-muted mb-1">Model</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Standard"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    />
                  </div>

                  <div className="col-6 col-md-4">
                    <label className="form-label small text-muted mb-1">Variant</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Green Handle"
                      value={formData.variant}
                      onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                    />
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label small text-muted mb-1">System Scope</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.system}
                      onChange={(e) => setFormData({ ...formData, system: e.target.value })}
                    />
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label small text-muted mb-1">Component</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.component}
                      onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                    />
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label small text-muted mb-1">Unit of Measure (UOM)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.uom}
                      onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    />
                  </div>

                  {/* Authorized Properties Key-Value Specifications */}
                  <div className="col-12">
                    <div className="p-3 bg-light rounded-2 border">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label small fw-semibold text-dark mb-0">
                          Properties (Key-Value Specifications)
                        </label>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm py-0 px-2"
                          style={{ fontSize: '0.75rem', height: '24px' }}
                          onClick={() => setPropertiesPairs([...propertiesPairs, { key: '', value: '' }])}
                        >
                          <i className="bi bi-plus me-1"></i>Add Property
                        </button>
                      </div>

                      {propertiesPairs.length === 0 ? (
                        <div className="text-muted small fst-italic py-1">
                          No custom technical properties added. Click "Add Property" to attach specifications (e.g. dimensions, power, volume, weight).
                        </div>
                      ) : (
                        <div className="d-flex flex-column gap-2 mt-2">
                          {propertiesPairs.map((pair, idx) => {
                            const matchedKeyDef = lookupPropertyKeys.find(
                              k => (k.Key || '').toLowerCase() === (pair.key || '').toLowerCase()
                            );
                            return (
                              <div key={idx} className="d-flex align-items-center gap-2">
                                <div style={{ minWidth: '190px', maxWidth: '240px' }} className="flex-shrink-0">
                                  <input
                                    list={`catalog-prop-keys-${idx}`}
                                    type="text"
                                    className="form-control form-control-sm font-monospace"
                                    placeholder="Property Key"
                                    value={pair.key}
                                    onChange={(e) => {
                                      const next = [...propertiesPairs];
                                      next[idx].key = e.target.value;
                                      setPropertiesPairs(next);
                                    }}
                                  />
                                  <datalist id={`catalog-prop-keys-${idx}`}>
                                    {lookupPropertyKeys.length > 0 ? (
                                      lookupPropertyKeys.map((k: any) => (
                                        <option key={k.Key} value={k.Key}>
                                          {k.Label || k.Key} {k.Allowed_Values_or_Unit ? `(${k.Allowed_Values_or_Unit})` : ''}
                                        </option>
                                      ))
                                    ) : (
                                      <>
                                        <option value="dimensions">Dimensions (e.g. 2 ft x 3 ft)</option>
                                        <option value="power">Power Rating (e.g. 750W, 1 HP)</option>
                                        <option value="volume">Volume / Liquid Capacity (e.g. 1 L, 500 ml)</option>
                                        <option value="weight">Weight / Mass (e.g. 25 kg, 100 g)</option>
                                        <option value="current_rating">Current Rating (e.g. 15A, 20A)</option>
                                        <option value="pack_count">Pack Count (e.g. 5's, 10's)</option>
                                        <option value="voltage">Voltage Rating (e.g. 220V, 240V)</option>
                                        <option value="storage_capacity">Storage Capacity (e.g. 16 GB, 1 TB)</option>
                                      </>
                                    )}
                                  </datalist>
                                </div>
                                <span className="text-muted">:</span>
                                <input
                                  type="text"
                                  className="form-control form-control-sm flex-grow-1"
                                  placeholder={
                                    matchedKeyDef?.Allowed_Values_or_Unit
                                      ? `Value (${matchedKeyDef.Allowed_Values_or_Unit})`
                                      : 'Value (e.g. 1/2in, 750W, 25 kg)'
                                  }
                                  value={pair.value}
                                  onChange={(e) => {
                                    const next = [...propertiesPairs];
                                    next[idx].value = e.target.value;
                                    setPropertiesPairs(next);
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn-icon-action action-delete"
                                  title="Remove property"
                                  onClick={() => setPropertiesPairs(propertiesPairs.filter((_, i) => i !== idx))}
                                >
                                  <i className="bi bi-trash3"></i>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-light rounded border">
                  <div className="small text-muted">Generated Fingerprint: <span className="font-monospace text-dark">{computedFingerprint}</span></div>
                </div>
              </div>

              <div className="modal-footer py-2 px-4 bg-light border-top">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-dark btn-sm"
                  disabled={!formData.name}
                  onClick={handleSaveItem}
                >
                  Save Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
