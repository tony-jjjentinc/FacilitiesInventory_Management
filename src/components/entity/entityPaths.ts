import type { EntityScopeType } from '../../types';

const BASE: Record<EntityScopeType, string> = {
  WAREHOUSE: '/warehouses', AREA: '/areas', ACTIVITY: '/activities', SUBDEPARTMENT: '/sub-departments', ITEM: '/items'
};

/** Hash-router path of an entity page. */
export const entityPath = (type: EntityScopeType, id: string, tab?: string) =>
  `${BASE[type]}/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ''}`;

export const ENTITY_LABEL: Record<EntityScopeType, string> = {
  WAREHOUSE: 'warehouse', AREA: 'area', ACTIVITY: 'activity', SUBDEPARTMENT: 'sub-department', ITEM: 'inventory item'
};

/** `Table` / config slug behind each entity's configuration record. */
export const ENTITY_CONFIG: Partial<Record<EntityScopeType, { table: string; slug: string; label: string }>> = {
  WAREHOUSE: { table: 'Warehouse_Location', slug: 'warehouse-location', label: 'Warehouse' },
  AREA: { table: 'Warehouse_Storage', slug: 'warehouse-storage', label: 'Storage' },
  ITEM: { table: 'Item', slug: 'item', label: 'Catalog item' }
};

export { peso, qty } from '../../utils/format'; // kept here so the entity screens import them from one place; the formatters live in utils/format.ts
