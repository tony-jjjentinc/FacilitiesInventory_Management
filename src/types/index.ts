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
  | 'Warehouse_Storage'
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
  Area_ID?: string;
  Warehouse_Name?: string;
  Area_Name?: string;
  System?: string;
  Component?: string;
  First_Received_At?: string;
  Last_Issued_At?: string;
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
  Unit_Cost?: number;
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
  /** short reference of an unexpected error (also in the server log) */
  errorRef?: string;
  /** only when the script property DEBUG_ERRORS is true: the real message and the top of the stack */
  detail?: string;
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
  layerId?: string;
}

export interface TransactionEntry {
  transactionId: string;
  timestamp: string;
  transactionType: string;
  sourceType: string;
  sourceRefId: string;
  /** names the API adds beside the references (blank when there is none) */
  sourceName?: string; destinationName?: string;
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
  Current_Net_Cost: number;
  Status: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  Sub_Department?: string;
}

export interface ActivityInventoryItem {
  Activity_Line_ID: string;
  Activity_ID: string;
  Item_ID: string;
  Item_SKU: string;
  Item_Name: string;
  Serial_Number?: string;
  Qty_Issued: number;
  Qty_Returned: number;
  Net_Used: number;
  Qty_Expended: number;
  UOM: string;
  Unit_Cost: number;
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


// ---------------------------------------------------------------------------
// Guided receiving (MRL / Manual)
// ---------------------------------------------------------------------------

export type ReceivingSourceType = 'MRL' | 'MANUAL' | 'PETTY_CASH' | 'RF' | 'RFP';
export type ReceivingDestination = 'ACTIVITY' | 'WAREHOUSE';

export interface PriceOption {
  source: 'SUPPLIER' | 'BASE';
  supplierId: string;
  supplierName: string;
  unitCost: number;
  preferred: boolean;
}

export interface ResolvedPrice {
  unitCost: number | null;
  source: 'SUPPLIER' | 'BASE' | 'NONE';
  supplierId: string;
  supplierName: string;
  options?: PriceOption[];
}

/** Where the unit cost on a receiving line comes from. */
export type LinePriceSource = 'SUPPLIER' | 'BASE' | 'NONE' | 'CUSTOM' | 'NEW_BASE';

export interface StagedMrlSummary {
  mrlNumber: string;
  mrqNumber: string;
  integr8GiNumber: string;
  releasedAt: string;
  batchNumber: string;
  projectName: string;
  classificationId: string;
  location: string;
  lineCount: number;
  totalQuantity: number;
  openQty?: number;
  suggestedSubDepartment?: string;
}

export interface MrlListResponse {
  mrls: StagedMrlSummary[];
  lastSyncedAt: string | null;
  pendingCount: number;
}

export interface MrlDetailLine {
  lineNo: number;
  itemId: string;
  itemSku: string;
  itemName: string;
  procurementName: string;
  requestedQty: number;
  releasedQty: number;
  uom: string;
  /** Unit of the item in the catalog (blank when the item is not in the catalog). */
  catalogUom: string;
  mapped: boolean;
  price: ResolvedPrice;
  priceOptions: PriceOption[];
}

export interface SuggestedActivity {
  activityId: string;
  activityName: string;
  status: string;
}

export interface MrlDetails {
  mrq: {
    mrqNumber: string;
    integr8MrNumber: string;
    dateRequested: string;
    dateRequired: string;
    classificationId: string;
    activityName: string;
    purpose: string;
    location: string;
    taggingNumber: string;
    costCenter: string;
    requestedBy: string;
    department: string;
    status: string;
  };
  mrl: {
    mrlNumber: string;
    integr8GiNumber: string;
    releasedAt: string;
    batchNumber: string;
    releaseType: string;
  };
  lines: MrlDetailLine[];
  suggestedActivity: SuggestedActivity | null;
}

export interface StorageWarehouse {
  id: string;
  name: string;
}

export interface StorageNode {
  storageId: string;
  warehouseLocation: string;
  storageType: 'AREA' | 'SHELF' | 'LEVEL' | 'CONTAINER' | 'SPACE';
  parentStorageId: string;
  name: string;
  shelfNumber: string;
  level: string;
  ownerSubDepartment: string;
  capacity?: number | null;
  capacityUnit?: string;
}

export interface StorageOptions {
  warehouses: StorageWarehouse[];
  storage: StorageNode[];
  subDepartments?: string[];
  uoms?: string[];
}

/** One editable receiving line (both modes). */
export interface ReceivingLine {
  key: string;
  lineNo?: number;
  itemId: string;
  itemName: string;
  mapped: boolean;
  requestedQty?: number;
  releasedQty?: number;
  receivedQty: string;
  uom: string;
  catalogUom?: string;
  unitCost: string;
  /** What the system resolved for the item (before the user touched it). */
  originalSource: ResolvedPrice['source'];
  originalCost: number | null;
  priceOptions: PriceOption[];
  priceSource: LinePriceSource;
  saveAsBasePrice: boolean;
  serialNumber: string;
  storageId: string;
  lineStatus: 'VERIFIED' | 'REJECTED';
  mismatchDetails: string;
}

export interface ReceivingParty {
  destinationType: ReceivingDestination;
  activityId: string;
  warehouseLocation: string;
  areaId: string;
  receiverId: string;
  /** why an activity of another project is chosen (a Head or Super Admin only; at least 5 characters) */
  mismatchReason?: string;
  /** receive the items straight away (only when the receiving party is the signed-in user) */
  autoReceive: boolean;
  remarks: string;
}

export interface ReceiptRecord {
  Receipt_ID: string;
  Source_Type: ReceivingSourceType;
  Source_Reference: string;
  MRQ_Number: string;
  Integr8_GI_Number: string;
  Classification_ID: string;
  Project_Name: string;
  Destination_Type: ReceivingDestination;
  Activity_ID: string;
  Warehouse_Location: string;
  Area_ID: string;
  Receiver_ID: string;
  Status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED';
  Submitted_By_ID: string;
  Submitted_At: string;
  Confirmed_By_ID: string;
  Confirmed_At: string;
  Transaction_ID: string;
  MRT_Number: string;
  Remarks: string;
  canConfirm: boolean;
  items: ReceiptLineRecord[];
  /** names the API adds beside the ids (api/NameService.gs); blank or the id itself when unknown */
  Receiver_Name?: string; Submitted_By_Name?: string; Assigned_To_Name?: string; Delegated_To_Name?: string; Warehouse_Name?: string; Area_Name?: string; Activity_Name?: string;
}

export interface ReceiptLineRecord {
  Receipt_Line_ID: string;
  Receipt_ID: string;
  Item_ID: string;
  Item_SKU: string;
  Item_Name: string;
  Requested_Qty: number | '';
  Released_Qty: number | '';
  Received_Qty: number;
  UOM: string;
  Unit_Cost: number;
  Price_Status: 'PRICED' | 'PENDING' | '';
  Serial_Number: string;
  Line_Status: 'VERIFIED' | 'REJECTED';
  Mismatch_Details: string;
  Storage_ID: string;
}

export interface OpenActivity {
  Activity_ID: string;
  Activity_Name: string;
  Status: string;
  ProcInv_Class_Ref?: string;
}

// ---------------------------------------------------------------------------
// Cost tracking (delivery piles)
// ---------------------------------------------------------------------------

export interface CostPile {
  layerId: string;
  receiptId: string;
  sourceTransactionId: string;
  receivedAt: string;
  areaId: string;
  storageId: string;
  serialNumber: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  value: number;
  priceStatus: 'PRICED' | 'PENDING';
  source: string;
  status: string;
}

export interface StockCostItem {
  itemId: string;
  itemName: string;
  location: string;
  uom: string;
  quantity: number;
  value: number;
  needsPrice: boolean;
  piles: CostPile[];
}

export interface StockCostsResponse {
  layersEnabled: boolean;
  items: StockCostItem[];
  totals: { quantity: number; value: number; needsPriceItems: number };
}

export interface ProjectCostLine {
  itemId: string;
  itemName: string;
  serialNumber: string;
  qtyIssued: number;
  qtyReturned: number;
  netUsed: number;
  qtyExpended: number;
  unitCostBilled: number;
  cost: number;
  needsPrice: boolean;
  piles: { layerId: string; quantity: number; unitCost: number; transactionId: string }[];
}

export interface ProjectCost {
  activityId: string;
  activityName: string;
  status: string;
  procInvClassRef: string;
  currentNetCost: number;
  needsPrice: boolean;
  lines: ProjectCostLine[];
}

export interface ProjectCostsResponse {
  activities: ProjectCost[];
  totals: { cost: number; needsPriceActivities: number };
}

// ---------------------------------------------------------------------------
// Analytics overview
// ---------------------------------------------------------------------------

export type AnalyticsGroup = 'SUBDEPARTMENT' | 'ACTIVITY' | 'ACTIVITY_TYPE' | 'SYSTEM' | 'COMPONENT';

export interface AnalyticsRow {
  key: string;
  label: string;
  issuedQty: number;
  issuedCost: number;
  consumedQty: number;
  consumedCost: number;
  receivedQty: number;
  receivedCost: number;
  onHandQty: number;
  onHandValue: number;
}

export interface AnalyticsOverviewResponse {
  from: string;
  to: string;
  groupBy: AnalyticsGroup;
  rows: AnalyticsRow[];
  totals: Omit<AnalyticsRow, 'key' | 'label'>;
  meta: { workbooks: number; stockAsOf: string; layersEnabled: boolean; notes: string[] };
}

export type AnalyticsPeriod = 'MONTH' | 'QUARTER' | 'YEAR';

export interface PerformanceCell {
  receivedQty: number; receivedCost: number;
  issuedQty: number; issuedCost: number;
  consumedQty: number; consumedCost: number;
}

/** analytics:getPerformance: quantity and cost per period for each group. */
export interface AnalyticsPerformanceResponse {
  groupBy: AnalyticsGroup;
  period: AnalyticsPeriod;
  from: string;
  to: string;
  buckets: { key: string; label: string }[];
  rows: { label: string; cells: Record<string, PerformanceCell>; totals: PerformanceCell }[];
  bucketTotals: Record<string, PerformanceCell>;
  totals: PerformanceCell;
  meta: { workbooks: number; notes: string[] };
}

/** Where an item is now, who holds it and since when (inventory:getItemTrace). */
export interface ItemTraceHolder {
  who: { custodianId?: string; custodianName?: string; subDepartment?: string };
  where: { locationType: string; warehouseLocation?: string; areaId?: string; siteNote?: string; activityId?: string; activityName?: string; siteLocation?: string; sourceAreaId?: string };
  when: { arrivedAt: string; lastUsedAt: string };
  quantity: number;
  uom: string;
  serialNumber: string;
}

export interface ItemTraceEvent {
  transactionId: string;
  type: string;
  status: string;
  who: { loggedById: string; accountablePartyId: string; subDepartment: string };
  where: { from: string; to: string; areaId: string; storageId: string };
  when: { at: string };
  quantity: number;
  uom: string;
  unitCost: number;
}

export interface ItemTrace {
  item: { itemId: string; sku: string; name: string };
  holders: { warehouse: ItemTraceHolder[]; custody: ItemTraceHolder[]; activities: ItemTraceHolder[] };
  events: ItemTraceEvent[];
}

/** An active account from the account directory (accounts:getDirectory). */
export interface DirectoryAccount {
  employeeNumber: string;
  name: string;
  email: string;
  roles: string[];
  departments: string[];
  subdepartments: string[];
  positions: string[];
}

// ---------------------------------------------------------------------------
// Entity pages (warehouse, area, activity, sub-department, item)
// ---------------------------------------------------------------------------
export type EntityScopeType = 'WAREHOUSE' | 'AREA' | 'ACTIVITY' | 'SUBDEPARTMENT' | 'ITEM';

export interface EntityFigure { label: string; value: string | number; kind: 'text' | 'money' | 'qty' }
export interface EntityParent { type: EntityScopeType; id: string; label: string }

export interface EntityProfile {
  scopeType: EntityScopeType;
  scopeRef: string;
  title: string;
  subtitle: string;
  badges: string[];
  figures: EntityFigure[];
  parents: EntityParent[];
  /** the configuration record behind the page (catalog row, warehouse row, storage row, ...) */
  record: Record<string, any>;
}

export interface EntityStockRow {
  inventoryId: string; itemId: string; sku: string; name: string; warehouse: string; areaId: string; areaName: string;
  serialNumber: string; onHand: number; uom: string; unitCost: number; valuation: number; ropStatus: string;
  firstReceivedAt: string; lastIssuedAt: string;
}
export interface EntityStock { rows: EntityStockRow[]; totals: { lines: number; quantity: number; value: number } }

export interface MixGroup { label: string; qty: number; value: number }
export interface EntityOverview {
  scopeType: EntityScopeType; scopeRef: string; totalValue: number; totalQty: number;
  byType: MixGroup[]; byCategory: MixGroup[];
  costHandled: { labels: string[]; received: number[]; issued: number[] };
  stockAge: MixGroup[];
  meta: { notes: string[] };
}

export interface EntityTimelineEvent {
  at: string; kind: 'LEDGER' | 'CONFIG'; type: string; title: string; detail: string; who: string; ref: string;
  status: string; qty: number | null; value: number | null; from?: string; to?: string;
}
export interface EntityTimeline { events: EntityTimelineEvent[]; total: number; nextCursor: number | null; years: number[]; year: number | null }

export interface EntityStorageNode {
  storageId: string; warehouseLocation: string; storageType: 'AREA' | 'SHELF' | 'LEVEL' | 'CONTAINER' | 'SPACE'; parentStorageId: string;
  name: string; shelfNumber: string; level: string; ownerSubDepartment: string; description: string; status: string;
  stockValue: number; items: number; lines: number; capacity: number | null; capacityUnit: string;
  /** units on this spot itself, and on it plus everything below it (shelf = its levels); only meaningful when the workbook tracks spots */
  qty: number; totalQty: number; spotItems: number;
}

export interface StorageNodesResponse { nodes: EntityStorageNode[]; tracked: boolean; unassigned?: { qty: number; lines: number } }

export interface SpotStockLine {
  spotId: string; spotName: string; itemId: string; sku: string; name: string; serialNumber: string; uom: string; qty: number; unitCost: number; value: number;
}
export interface SpotStock { lines: SpotStockLine[]; totals: { lines: number; quantity: number }; tracked: boolean }

export interface WarehouseListRow { id: string; name: string; stockValue: number; items: number; areas: number }

export interface ItemOverview {
  scopeType: 'ITEM'; scopeRef: string; uom: string;
  suppliers: { supplierId: string; supplierName: string; price: number; preferred: boolean; effectiveDate: string }[];
  received: { at: string; unitCost: number; qty: number; ref: string }[];
  corrections: { at: string; oldCost: number; newCost: number; qty: number; reason: string }[];
  usage: { labels: string[]; issued: number[]; consumed: number[]; avgMonthly: number; daysOfCover: number | null };
  stock: { onHand: number; status: string; byWarehouse: MixGroup[] };
  meta: { notes: string[] };
}

export interface ItemDistribution {
  scopeType: 'ITEM'; scopeRef: string;
  destinations: MixGroup[];
  warehouse: MixGroup[];
  custody: { label: string; sub: string; qty: number; value: number }[];
  activities: { label: string; id: string; qty: number; value: number }[];
  /** where in the warehouse: per area, the shelf/level it sits on ("Whole area" when not on a spot) */
  spots?: { label: string; areaId: string; spotId: string; spot: string; qty: number }[];
  meta: { notes: string[] };
}

export interface ActivityOverview {
  scopeType: 'ACTIVITY'; scopeRef: string; totalValue: number; totalQty: number;
  byType: MixGroup[]; byCategory: MixGroup[];
  burn: { labels: string[]; cumulative: number[]; targetEnd: string };
  schedule: { start: string; targetEnd: string; completedAt: string; plannedDays: number | null; actualDays: number | null; overdue: boolean };
  returns: { issued: number; returned: number; rate: number | null };
  subDepartments: string[];
  meta: { notes: string[] };
}

export interface SubDepartmentOverview {
  scopeType: 'SUBDEPARTMENT'; scopeRef: string;
  trend: { labels: string[]; issuedCost: number[]; consumedCost: number[]; receivedCost: number[]; issuedQty: number[]; consumedQty: number[] };
  topItems: { itemId: string; name: string; qty: number; value: number }[];
  idleTools: { custodian: string; itemId: string; name: string; qty: number; since: string; neverUsed: boolean; days: number }[];
  idleCount: number; idleDays: number; pendingLoss: number;
  meta: { notes: string[] };
}
export interface SubDepartmentCustody {
  tools: { custodyId: string; custodian: string; itemId: string; name: string; serialNumber: string; qty: number; uom: string; assignedAt: string; lastUsedAt: string; status: string; site: string }[];
  consumed: { consumptionId: string; at: string; itemId: string; name: string; qty: number; uom: string; cost: number; scope: string; reference: string; purpose: string; loggedBy: string }[];
}
export interface SubDepartmentLoss {
  rows: { lossId: string; date: string; type: string; status: string; lines: number; qty: number; cost: number; description: string }[];
  totalCost: number;
}
export interface SubDepartmentListRow { name: string; tools: number; consumedCost: number; activities: number }

// ---------------------------------------------------------------------------
// MRL assignments (Head assigns, Sub-Department verifies, FMS may be delegated)
// ---------------------------------------------------------------------------
export interface TaskLine {
  Receipt_Line_ID: string; Item_ID: string; Item_Name: string; Requested_Qty: number | string; Released_Qty: number | string; Received_Qty: number | string;
  Returned_Qty: number | string; Short_Qty: number | string; Short_Resolution: string; Mismatch_Type: string; Mismatch_Details: string; UOM: string; Line_Status: string;
  Staged_Line_No: number | string;
  /** the catalog price this line would get (getTask); the cost keys are missing for roles that cannot see costs */
  price?: { unitCost?: number | null; source?: string; supplierName?: string } | null;
}
export interface MrlTask {
  Receipt_ID: string; Source_Reference: string; MRQ_Number: string; Project_Name: string; Status: string; Sub_Department: string; Assigned_To_ID: string;
  Delegated_To_ID: string; Receiver_ID: string; Parent_Receipt_ID: string; Release_Confirmed_By_ID: string; Destination_Type: string; Activity_ID: string;
  Warehouse_Location: string; Area_ID: string; Transaction_ID: string; MRT_Number: string; items: TaskLine[];
  canVerify: boolean; canDelegate: boolean; canTakeBack: boolean;
  /** names the API adds beside the ids (api/NameService.gs); blank or the id itself when unknown */
  Receiver_Name?: string; Submitted_By_Name?: string; Assigned_To_Name?: string; Delegated_To_Name?: string; Warehouse_Name?: string; Area_Name?: string; Activity_Name?: string;
  Classification_ID?: string;
  /** a Head's approval to charge one activity of another project */
  projectOverride?: { activityId: string; reason: string; by: string } | null;
  /** that activity's details, so the assignee can pick it even when it belongs to another sub-department */
  approvedActivity?: { id: string; name: string; status: string; classificationRef: string; subDepartment: string } | null;
}
export interface MrqItemProgress {
  itemId: string; name: string; uom: string; requested: number; released: number; received: number; returned: number; open: number; waiting: number; notReleased: number; state: string;
  batches: { mrlNumber: string; batch: string; quantity: number }[];
}
export interface MrqProgress { mrqNumber: string; project: string; classificationId: string; requestedBy: string; department: string; complete: boolean; openItems: number; items: MrqItemProgress[] }
export interface MrtRecord { MRT_Number: string; MRL_Number: string; MRQ_Number: string; Return_Date: string; Return_Reason: string; Status: string; Total_Returned_Items: number; items: { MRT_Line_ID: string; Requested_Item_Name: string; Delivered_Item_Name: string; Quantity_Returned: number; UOM: string; Mismatch_Details: string }[] }
