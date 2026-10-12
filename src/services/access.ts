/**
 * @file access.ts
 * @description What the signed-in user may see and do. Mirrors the API (api/Auth.gs tiers and api/AccessPolicy.gs) so the
 * screens hide what the API would refuse. The API is the real gate; this only keeps the screens honest.
 *
 *   isAdmin       Super Admin or Head of Facilities (Configuration, Admin hub, approvals, set price)
 *   isCustodian   Super Admin, Head, Sub-Department or Staff of Facilities (receiving, dispatch, deploy, retrieve, sync)
 *   canField      isCustodian, or FMS of Facilities (log usage, return surplus, hand over a tool, confirm a receipt)
 *   fieldOnly     an FMS with no custodian role (can only hand over tools they hold)
 *   canSeeCosts   Super Admin, Head, and Staff or Sub-Department of Facilities. Not FMS, not other GMO accounts.
 *   canSeeAnalytics  Super Admin, Head (any department), Sub-Department of Facilities
 *   canAddToCatalog  Super Admin, Head or Sub-Department of Facilities
 */

import type { UserClaims } from '../types';

export interface Access {
  isAdmin: boolean;
  isCustodian: boolean;
  canField: boolean;
  fieldOnly: boolean;
  canSeeCosts: boolean;
  canSeeAnalytics: boolean;
  canAddToCatalog: boolean;
  isFacilities: boolean;
  email: string;
  id: string;
}

const lower = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x).trim().toLowerCase());

export function getAccess(user: Partial<UserClaims> | null | undefined): Access {
  const roles = lower(user?.roles);
  const depts = lower(user?.department);
  const has = (...wanted: string[]) => roles.some(r => wanted.includes(r));
  const facilities = depts.includes('facilities');
  const top = has('super admin', 'head');
  const custodianRole = has('super admin', 'head', 'sub-department', 'staff');
  return {
    isAdmin: top && facilities,
    isCustodian: custodianRole && facilities,
    canField: (custodianRole || has('fms')) && facilities,
    fieldOnly: has('fms') && !custodianRole,
    canSeeCosts: top || (facilities && has('staff', 'sub-department')),
    canSeeAnalytics: top || (facilities && has('sub-department')),
    canAddToCatalog: has('super admin', 'head', 'sub-department') && facilities,
    isFacilities: facilities,
    email: String(user?.email || '').trim().toLowerCase(),
    id: String(user?.id || '').trim().toLowerCase()
  };
}

/** Does this user hold the tool? (custodian id is the holder's email or account id) */
export function holdsTool(access: Access, custodianId: string | undefined): boolean {
  const h = String(custodianId || '').trim().toLowerCase();
  return !!h && (h === access.email || h === access.id);
}

/** Column keys that show money. Tables drop them for accounts that may not see costs. */
export const COST_COLUMN_KEYS = [
  'Unit_Cost', 'Valuation', 'Total_Cost', 'Current_Net_Cost', 'unitCost', 'valuation', 'totalCost', 'cost', 'value',
  'stockValue', 'consumedCost', 'Est_Cost', 'issuedCost', 'receivedCost', 'onHandValue'
];

export function hideCosts<T extends { key: string }>(columns: T[], access: Access): T[] {
  return access.canSeeCosts ? columns : columns.filter(c => !COST_COLUMN_KEYS.includes(c.key));
}
