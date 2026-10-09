/**
 * @file receivingUtils.ts
 * @description Shared helpers for the guided receiving tabs: storage paths, payload building and validation.
 */
import type {
  MrlDetails,
  ReceivingLine,
  ReceivingParty,
  ReceivingSourceType,
  StorageNode
} from '../../types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function nodeLabel(n: StorageNode): string {
  if (n.storageType === 'SHELF') return `Shelf ${n.shelfNumber || n.name}`;
  if (n.storageType === 'LEVEL') return `Level ${n.level || n.name}`;
  return n.name || n.storageId;
}

/** "Shelf 3 > Level 2 > Container C1" for a storage spot (area excluded). */
export function spotPath(nodes: StorageNode[], id: string): string {
  const byId = new Map(nodes.map(n => [n.storageId, n]));
  const parts: string[] = [];
  let cur = byId.get(id);
  for (let hops = 0; cur && cur.storageType !== 'AREA' && hops < 10; hops++) {
    parts.unshift(nodeLabel(cur));
    cur = byId.get(cur.parentStorageId);
  }
  return parts.join(' › ');
}

/** Every spot (shelf, level, container, space) inside the given area. */
export function spotsInArea(nodes: StorageNode[], areaId: string): StorageNode[] {
  if (!areaId) return [];
  const byId = new Map(nodes.map(n => [n.storageId, n]));
  return nodes.filter(n => {
    if (n.storageType === 'AREA') return false;
    let cur: StorageNode | undefined = n;
    for (let hops = 0; cur && hops < 10; hops++) {
      if (cur.storageId === areaId) return true;
      cur = byId.get(cur.parentStorageId);
    }
    return false;
  });
}

/** A plain date (yyyy-MM-dd). Also tidies a JavaScript date string such as "Mon Jun 29 2026 00:00:00 GMT+0800 (...)". */
export function simpleDate(v: string | undefined | null): string {
  const t = String(v || '').trim();
  if (!/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2}/.test(t)) return t;
  const d = new Date(t.replace(/\s*\(.*\)$/, ''));
  if (isNaN(d.getTime())) return t;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Activity as shown in dropdowns: "[Classification No.] Project Name". */
export function activityLabel(a: { Activity_ID: string; Activity_Name: string; ProcInv_Class_Ref?: string }): string {
  return `[${a.ProcInv_Class_Ref || 'No Classification No.'}] ${a.Activity_Name || a.Activity_ID}`;
}

export function newLineKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Returns an error message, or null when the form can be submitted. */
export function validateReceiving(
  mode: 'MRL' | 'MANUAL',
  reference: string,
  lines: ReceivingLine[],
  party: ReceivingParty,
  _myEmail: string
): string | null {
  if (!reference.trim()) return mode === 'MRL' ? 'Select or enter an MRL number.' : 'Enter the voucher or reference number.';
  if (lines.length === 0) return 'There are no lines to receive.';
  for (const l of lines) {
    if (l.lineStatus === 'REJECTED') continue;
    if (!l.mapped) return `Line "${l.itemName}" has no catalog item. Map it in Configuration, or mark it invalid.`;
    const qty = Number(l.receivedQty);
    if (!isFinite(qty) || qty <= 0) return `Enter a received quantity for ${l.itemName}.`;
    if (l.releasedQty !== undefined && qty > l.releasedQty) return `${l.itemName}: received quantity cannot exceed the released quantity (${l.releasedQty}).`;
    const cost = l.unitCost.trim() === '' ? 0 : Number(l.unitCost);
    if (!isFinite(cost) || cost < 0) return `${l.itemName}: unit cost must be 0 or more.`;
    if (l.saveAsBasePrice && cost <= 0) return `${l.itemName}: a base price needs a unit cost above 0.`;
  }
  if (!lines.some(l => l.lineStatus === 'VERIFIED') && mode === 'MANUAL') return 'Add at least one line.';
  if (party.destinationType === 'ACTIVITY' && !party.activityId) return 'Choose the activity that receives these items.';
  if (party.destinationType === 'WAREHOUSE' && !party.warehouseLocation) return 'Choose the receiving warehouse.';
  if (!EMAIL_RE.test(party.receiverId.trim())) return "Enter the receiving party's email address.";
  return null;
}

export function buildPayload(
  sourceType: ReceivingSourceType,
  reference: string,
  details: MrlDetails | null,
  lines: ReceivingLine[],
  party: ReceivingParty
) {
  return {
    sourceType,
    sourceReference: reference.trim(),
    mrqNumber: details?.mrq.mrqNumber || '',
    integr8GiNumber: details?.mrl.integr8GiNumber || '',
    destinationType: party.destinationType,
    activityId: party.destinationType === 'ACTIVITY' ? party.activityId : '',
    warehouseLocation: party.warehouseLocation,
    areaId: party.destinationType === 'WAREHOUSE' ? party.areaId : '',
    receiverId: party.receiverId.trim().toLowerCase(),
    autoReceive: party.autoReceive,
    remarks: party.remarks.trim(),
    items: lines.map(l => ({
      lineNo: l.lineNo,
      itemId: l.itemId,
      itemName: l.itemName,
      lineStatus: l.lineStatus,
      receivedQty: l.lineStatus === 'VERIFIED' ? Number(l.receivedQty) : undefined,
      uom: l.uom,
      unitCost: l.unitCost.trim() === '' ? 0 : Number(l.unitCost),
      priceStatus: l.unitCost.trim() === '' || Number(l.unitCost) === 0 ? 'PENDING' : 'PRICED',
      saveAsBasePrice: l.saveAsBasePrice && Number(l.unitCost) > 0,
      serialNumber: l.serialNumber.trim() || 'N/A',
      storageId: party.destinationType === 'WAREHOUSE' ? l.storageId : '',
      mismatchDetails: l.mismatchDetails
    }))
  };
}

/** Line fields for a freshly resolved price (used by the MRL details and the manual adder). */
export function priceFields(price: { unitCost: number | null; source: 'SUPPLIER' | 'BASE' | 'NONE'; options?: import('../../types').PriceOption[] }) {
  return {
    unitCost: price.unitCost !== null ? String(price.unitCost) : '',
    originalSource: price.source,
    originalCost: price.unitCost,
    priceOptions: price.options || [],
    priceSource: price.source as import('../../types').LinePriceSource,
    saveAsBasePrice: false
  };
}

/** Applies a typed unit cost: a new price on an unpriced item becomes its base price; a changed price is custom. */
export function withTypedCost(l: ReceivingLine, value: string): ReceivingLine {
  const cost = value.trim() === '' ? 0 : Number(value);
  if (l.originalSource === 'NONE') {
    return { ...l, unitCost: value, priceSource: cost > 0 ? 'NEW_BASE' : 'NONE', saveAsBasePrice: cost > 0 };
  }
  const same = l.originalCost !== null && cost === l.originalCost;
  return { ...l, unitCost: value, priceSource: same ? l.originalSource : 'CUSTOM', saveAsBasePrice: false };
}
