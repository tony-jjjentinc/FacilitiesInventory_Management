/**
 * @file index.ts
 * @description Central TypeScript contracts for the Facilities Inventory Management Dashboard.
 */

export interface UserClaims {
  id: string;
  employee_number?: string;
  name: string;
  email: string;
  roles: string[];
  department: string[];
  subdepartments?: string[];
  positions?: string[];
  exp?: number;
}

export type InventoryTypeCode = 'CNS' | 'TLS' | 'SPR' | 'MSC';

export type ConfigTableKey =
  | 'Item'
  | 'Supplier'
  | 'Item_Supplier_and_Pricing'
  | 'Inventory_Category'
  | 'Inventory_Property_Keys'
  | 'UOM'
  | 'UOM_Category'
  | 'Warehouse_Location'
  | 'Sheet_Records'
  | 'Rollover';

export interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  model: string;
  variant: string;
  properties: string;
  propertyFingerprint?: string;
  searchTags?: string;
  system: string;
  component: string;
  uom: string;
  inventoryTypeCode: InventoryTypeCode;
  categoryId: string;
  categoryName: string;
  status: 'ACTIVE' | 'DISCONTINUED' | 'PHASED_OUT';
}

export interface WarehouseStockItem {
  Inventory_ID: string;
  Warehouse_Location: string;
  Item_ID: string;
  Item_SKU: string;
  Item_Name: string;
  Serial_Number: string;
  Classification: string;
  On_Hand_Qty: number;
  UOM: string;
  Unit_Cost: number;
  Valuation: number;
  ROP_Status: 'NORMAL' | 'REORDER_WARNING' | 'CRITICAL_DEPLETION';
  Last_Transaction_ID: string;
  Last_Updated: string;
}

export interface InHouseCustodyItem {
  Custody_ID: string;
  Custodian_ID: string;
  Custodian_Name: string;
  Item_ID: string;
  Item_SKU: string;
  Item_Name: string;
  Serial_Number: string;
  Quantity: number;
  UOM: string;
  Date_Assigned: string;
  Status: string;
  Last_Transaction_ID: string;
  Remarks: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  count: number;
  severity: 'INFO' | 'WARNING' | 'DANGER';
  route: string;
}

export interface LossIncident {
  lossId: string;
  incidentDate: string;
  lossType: string;
  originType: string;
  originRefId: string;
  liablePartyId: string;
  authorizedById: string;
  approvalStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedAt: string;
  transactionId: string;
  incidentDescription: string;
  attachmentUrl: string;
}

export interface ProcurementMapping {
  mappingId: string;
  procurementDescription: string;
  mappedItemId: string;
  confidenceScore: number;
  verifiedBy: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  errorCode: string | null;
  durationMs?: number;
  timestamp: string;
}

export interface SystemInfo {
  name: string;
  service?: string;
  shortName: string;
  subtitle: string;
  version: string;
  status?: string;
  time?: string;
  timestamp?: string;
}

export interface TransactionLineItem {
  entryId: string;
  itemId: string;
  sku: string;
  name: string;
  serialNumber?: string;
  supplierId?: string;
  quantity: number;
  uom: string;
  unitCost: number;
  totalCost: number;
  remarks?: string;
}

export interface TransactionEntry {
  transactionId: string;
  timestamp: string;
  transactionType: string;
  sourceType: string;
  sourceRefId: string;
  destinationType: string;
  destinationRefId: string;
  loggedById: string;
  accountablePartyId: string;
  status: 'PENDING' | 'POSTED' | 'VOIDED';
  remarks?: string;
  items: TransactionLineItem[];
  totalItems: number;
  totalCost: number;
}

export interface ActivityRecord {
  Activity_ID: string;
  Activity_Name: string;
  Activity_Type: string;
  Site_Location: string;
  Start_Date: string;
  Target_End_Date: string;
  Completed_At?: string;
  Site_Supervisor_ID: string;
  Allocated_Budget: number;
  Current_Net_Cost: number;
  Status: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
}

export interface ActivityInventoryItem {
  Activity_Line_ID: string;
  Activity_ID: string;
  Item_ID: string;
  Item_SKU: string;
  Item_Name: string;
  Serial_Number_Class?: string;
  Qty_Issued: number;
  Qty_Returned: number;
  Net_Used: number;
  Qty_Expended: number;
  UOM: string;
  Unit_Cost_Billed_Cost: number;
  Item_Tracking_State: 'DEPLOYED' | 'CONSUMED' | 'PARTIALLY_RETURNED' | 'WRITTEN_OFF' | 'PARTIAL_USED';
}

export type ConsumptionScope = 'ACTIVITY' | 'IN_HOUSE' | 'WAREHOUSE';

export interface ConsumedInventoryItem {
  Consumption_ID: string;
  Timestamp: string;
  Consumption_Scope: ConsumptionScope;
  Reference_ID: string;
  Reference_Name?: string;
  Item_ID: string;
  Item_SKU: string;
  Item_Name: string;
  Serial_Number?: string;
  Classification: string;
  Quantity: number;
  UOM: string;
  Unit_Cost: number;
  Total_Cost: number;
  Purpose: string;
  Work_Description?: string;
  Logged_By_ID: string;
  Accountable_Party_ID: string;
  Transaction_ID: string;
  Status: 'POSTED' | 'VOIDED';
  Remarks?: string;
}

