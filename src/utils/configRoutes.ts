import type { ConfigTableKey } from '../types';

export const CONFIG_SLUG_MAP: { slug: string; key: ConfigTableKey }[] = [
  { slug: 'item', key: 'Item' },
  { slug: 'supplier', key: 'Supplier' },
  { slug: 'pricing', key: 'Item_Supplier_and_Pricing' },
  { slug: 'category', key: 'Inventory_Category' },
  { slug: 'property-keys', key: 'Inventory_Property_Keys' },
  { slug: 'uom', key: 'UOM' },
  { slug: 'uom-category', key: 'UOM_Category' },
  { slug: 'warehouse-location', key: 'Warehouse_Location' },
  { slug: 'fiscal-source', key: 'Sheet_Records' },
];

export function slugToConfigKey(slug?: string): ConfigTableKey {
  if (!slug) return 'Item';
  if (slug.toLowerCase() === 'rollover') return 'Sheet_Records';
  const found = CONFIG_SLUG_MAP.find(m => m.slug.toLowerCase() === slug.toLowerCase());
  return found ? found.key : 'Item';
}

export function configKeyToSlug(key: ConfigTableKey): string {
  const found = CONFIG_SLUG_MAP.find(m => m.key === key);
  return found ? found.slug : 'item';
}
