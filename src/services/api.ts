/**
 * @file api.ts
 * @description Standardized HTTP client communicating with the Google Apps Script Web App
 * utilizing the JJJEI CORS-bypass transport protocol (text/plain;charset=utf-8).
 */

import type { ApiResponse } from '../types';
import { getStoredToken, clearStoredToken } from './auth';

const API_URL = import.meta.env.VITE_GAS_API_URL || '';

/** Error carrying the API's errorCode (e.g. SESSION_EXPIRED, INSUFFICIENT_STOCK). */
export class ApiError extends Error {
  code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export const SESSION_EXPIRED_EVENT = 'jjjei:session-expired';

/**
 * Dispatches a POST request to the Google Apps Script Web App.
 */
export async function apiRequest<T = any>(action: string, payload: any = {}): Promise<T> {
  const token = getStoredToken() || '';

  // Local sandbox mock fallback if no API_URL is provided in development
  if (!API_URL) {
    console.warn(`[API] VITE_GAS_API_URL not configured. Simulating '${action}' locally.`);
    return mockLocalResponse(action, payload);
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action,
      token,
      payload
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    if (result.errorCode === 'SESSION_EXPIRED' && token) {
      // Server says the session is over: drop the token and let the app return to the login screen
      clearStoredToken();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(result.error || result.errorCode || 'Unknown API error occurred.', result.errorCode);
  }

  return result.data as T;
}

/**
 * Mock response generator for local frontend development prior to Apps Script deployment.
 */
function mockLocalResponse(action: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      switch (action) {
        case 'system:info':
        case 'ping':
          resolve({
            status: 'UP',
            name: 'Facilities Inventory and Warehousing Management',
            shortName: 'Facilities Inventory',
            subtitle: 'Management Dashboard',
            version: 'v1.0.0',
            time: new Date().toISOString()
          });
          break;

        case 'auth:login':
          if (payload.password === 'error') {
            reject(new Error('AUTH_ERROR: Invalid credentials.'));
            return;
          }
          resolve({ token: 'mock.header.payload' });
          break;

        case 'notifications:get':
          resolve([
            {
              id: 'NOTIF_PENDING_INCIDENTS',
              type: 'ACTION_REQUIRED',
              category: 'INCIDENTS',
              title: '2 Pending Incident Approvals',
              message: '2 loss reports are awaiting Department Head review.',
              count: 2,
              severity: 'WARNING',
              route: '/approvals'
            },
            {
              id: 'NOTIF_ROP_CRITICAL',
              type: 'ALERT',
              category: 'INVENTORY',
              title: '3 Items Below Safety Stock',
              message: 'Consumable stock critically depleted.',
              count: 3,
              severity: 'DANGER',
              route: '/alerts'
            }
          ]);
          break;

        case 'inventory:getWarehouseStock':
          resolve([
            {
              Inventory_ID: 'WH_MAIN_ITM-0001_NA',
              Warehouse_Location: 'FACILITIES_WAREHOUSE_MAIN',
              Item_ID: 'ITM-0001',
              Item_SKU: 'CNS-PLB-0001',
              Item_Name: 'PPR Pipe 1/2" x 4m',
              Serial_Number: 'N/A',
              Classification: 'CNS',
              On_Hand_Qty: 45,
              UOM: 'pc',
              Unit_Cost: 345.5,
              Valuation: 15547.5,
              ROP_Status: 'NORMAL',
              Last_Transaction_ID: 'TXN-2026-0001',
              Last_Updated: '2026-09-28 08:30:00'
            },
            {
              Inventory_ID: 'WH_MAIN_ITM-0042_NA',
              Warehouse_Location: 'FACILITIES_WAREHOUSE_MAIN',
              Item_ID: 'ITM-0042',
              Item_SKU: 'CNS-HVA-0042',
              Item_Name: 'R-410A Refrigerant 11.3kg',
              Serial_Number: 'N/A',
              Classification: 'CNS',
              On_Hand_Qty: 2,
              UOM: 'cyl',
              Unit_Cost: 4800,
              Valuation: 9600,
              ROP_Status: 'CRITICAL_DEPLETION',
              Last_Transaction_ID: 'TXN-2026-0005',
              Last_Updated: '2026-09-28 09:15:00'
            }
          ]);
          break;

        case 'catalog:getItems':
          resolve([
            {
              ID: 'ITM-0001',
              SKU: 'CNS-PLB-0001',
              Name: 'PPR Pipe 1/2" x 4m',
              Brand: 'Pipelife',
              Model: 'PN20',
              Variant: 'Green',
              Properties: '{"diameter":"1/2in","rating":"PN20"}',
              Property_Fingerprint: 'PLB|PIPELIFE|PN20|GREEN',
              Search_Tags: 'ppr, pipe, water, plumbing',
              System: 'Plumbing & Sanitary',
              Component: 'Piping Network',
              UOM: 'pc',
              Inventory_Type_Code: 'CNS',
              Category_ID: 'PLB',
              Category_Name: 'Plumbing Supplies',
              Status: 'ACTIVE'
            },
            {
              ID: 'ITM-0045',
              SKU: 'TLS-PWR-0045',
              Name: 'Dewalt Cordless Impact Driver 18V',
              Brand: 'Dewalt',
              Model: 'DCF887N',
              Variant: 'Brushless',
              Properties: '{"voltage":"18V","chuck":"1/4in"}',
              Property_Fingerprint: 'PWR|DEWALT|DCF887N|BRUSHLESS',
              Search_Tags: 'dewalt, impact, driver, tool',
              System: 'General Operations',
              Component: 'Power Tools',
              UOM: 'set',
              Inventory_Type_Code: 'TLS',
              Category_ID: 'PWR',
              Category_Name: 'Power Tools',
              Status: 'ACTIVE'
            }
          ]);
          break;

        case 'rop:evaluate':
          resolve({ itemsEvaluated: 12, criticalCount: 1, warningCount: 2, normalCount: 9 });
          break;

        case 'rollover:check':
          resolve({ ready: true, issues: [] });
          break;

        case 'config:getTable': {
          const table = payload.table;
          const mockTables: Record<string, any[]> = {
            Item: [
              { ID: 'ITM-0001', SKU: 'CNS-PLB-0001', Name: 'PPR Pipe 1/2" x 4m', Brand: 'ERA', Model: 'PN20', Variant: 'Green', Category_ID: 'PLB', Category_Name: 'Plumbing Supplies', Inventory_Type_Code: 'CNS', UOM: 'pc', Status: 'ACTIVE', Properties: '{"pressure_rating": "20 bar", "material": "Polypropylene Random"}', Property_Fingerprint: 'FGP-001', Search_Tags: 'ppr, pipe, plumbing, water' },
              { ID: 'ITM-0045', SKU: 'TLS-PWR-0045', Name: 'Cordless Impact Driver 18V', Brand: 'Dewalt', Model: 'DCF887N', Variant: 'Bare Tool', Category_ID: 'PWR', Category_Name: 'Power Tools', Inventory_Type_Code: 'TLS', UOM: 'set', Status: 'ACTIVE', Properties: '{"torque": "205 Nm", "voltage": "18V"}', Property_Fingerprint: 'FGP-045', Search_Tags: 'dewalt, impact, driver, power tool' }
            ],
            Inventory_Property_Keys: [
              { Key: 'voltage', Label: 'Operating Voltage', Description: 'Input electrical voltage requirement', Data_Type: 'STRING' },
              { Key: 'pressure_rating', Label: 'Pressure Rating', Description: 'Nominal maximum pressure rating (PN/bar)', Data_Type: 'STRING' },
              { Key: 'diameter', Label: 'Diameter', Description: 'External or nominal conduit diameter', Data_Type: 'STRING' }
            ],
            Inventory_Type: [
              { Code: 'CNS', Name: 'Consumable Material', Description: 'Expendable project materials' },
              { Code: 'TLS', Name: 'Tool / Asset', Description: 'Reusable serialized tools and equipment' }
            ],
            Supplier: [
              { ID: 'SUP-001', Name: 'Amco Industrial Hardware', Contact_Person: 'Eduardo Santos', Phone: '0917-555-0192', Email: 'sales@amco-ph.com', Status: 'ACTIVE', Description: 'Industrial tools and construction hardware', Address_JSON: '{"city": "Makati", "country": "Philippines"}' },
              { ID: 'SUP-002', Name: 'Pipelife Philippines Corp.', Contact_Person: 'Maria Reyes', Phone: '0922-888-4411', Email: 'orders@pipelife.ph', Status: 'ACTIVE', Description: 'Piping solutions and plumbing fixtures', Address_JSON: '{"city": "Pasig", "country": "Philippines"}' }
            ],
            Item_Supplier_and_Pricing: [
              { Record_ID: 'ISP-0001', Item_ID: 'ITM-0001', Item_Name: 'PPR Pipe 1/2" x 4m', Supplier_ID: 'SUP-002', Supplier_Name: 'Pipelife Philippines Corp.', Price_per_Unit: 245.00, UOM: 'pc', Discount_Percentage: 5, Discount_Type: 'PERCENT', Effective_Date: '2026-01-01', Is_Preferred: true, Remarks: 'Standard contracted rate' },
              { Record_ID: 'ISP-0002', Item_ID: 'ITM-0045', Item_Name: 'Cordless Impact Driver 18V', Supplier_ID: 'SUP-001', Supplier_Name: 'Amco Industrial Hardware', Price_per_Unit: 8500.00, UOM: 'set', Discount_Percentage: 0, Discount_Type: 'NONE', Effective_Date: '2026-01-15', Is_Preferred: true, Remarks: '1-year warranty included' }
            ],
            Inventory_Category: [
              { ID: 'PLB', SKU_Prefix: 'PLB', Name: 'Plumbing Supplies', Description: 'Pipes, fittings, valves, drains' },
              { ID: 'ELE', SKU_Prefix: 'ELE', Name: 'Electrical Supplies', Description: 'Wires, breakers, conduit, fixtures' },
              { ID: 'HVA', SKU_Prefix: 'HVA', Name: 'HVAC & Refrigeration', Description: 'Compressors, refrigerant, filters' },
              { ID: 'CIV', SKU_Prefix: 'CIV', Name: 'Civil & Masonry', Description: 'Cement, sand, aggregates, tiles' },
              { ID: 'PWR', SKU_Prefix: 'PWR', Name: 'Power Tools', Description: 'Drills, saws, grinders, impacts' }
            ],
            UOM: [
              { ID: 'pc', Unit: 'pc', Name: 'Piece', Category: 'COUNT', Description: 'Discrete individual item count' },
              { ID: 'box', Unit: 'box', Name: 'Box', Category: 'COUNT', Description: 'Packaged box unit' },
              { ID: 'mtr', Unit: 'mtr', Name: 'Meter', Category: 'LENGTH', Description: 'Linear meter measurement' },
              { ID: 'set', Unit: 'set', Name: 'Set / Kit', Category: 'COUNT', Description: 'Pre-assembled tool or fitting set' },
              { ID: 'cyl', Unit: 'cyl', Name: 'Cylinder', Category: 'VOLUME', Description: 'Compressed gas or refrigerant tank' }
            ],
            UOM_Category: [
              { ID: 'COUNT', Name: 'Discrete Item Count', Description: 'Unit count of discrete objects' },
              { ID: 'LENGTH', Name: 'Linear Measurement', Description: 'Meters, feet, inches' },
              { ID: 'VOLUME', Name: 'Volumetric Measure', Description: 'Liters, gallons, cylinders' }
            ],
            Warehouse_Location: [
              { ID: 'LOC-MAIN', Name: 'Central Facilities Depot', Description: 'Building A primary storage warehouse' },
              { ID: 'LOC-NORTH', Name: 'North Sub-Warehouse', Description: 'Building C maintenance staging unit' }
            ],
            Sheet_Records: [
              { Year: 2026, Sheet_ID: '1qZw8yXoPmLkRt9vBn4uCe7dAw1sEf2Gh3Jk5LmNoPqR', Sheet_URL: 'https://docs.google.com/spreadsheets/d/1qZw8yXoPmLkRt9vBn4uCe7dAw1sEf2Gh3Jk5LmNoPqR', Status: 'ACTIVE', Created_At: '2026-01-01', Closed_At: '' }
            ],
            CONFIG: [
              { System: 'HVAC Chilled Water System', Component: 'Chilled Water Loop' },
              { System: 'HVAC Stand Alone System', Component: 'Air Handling Unit (AHU)' },
              { System: 'Lifting System', Component: 'Elevator & Escalator' },
              { System: 'Fire Detection and Alarm System', Component: 'Fire Alarm & Detection' },
              { System: 'Fire Protection System', Component: 'Sprinkler Network' },
              { System: 'Electrical System', Component: 'Power Distribution' },
              { System: 'Emergency Power Supply', Component: 'Generator Set' },
              { System: 'Fire Fighting Emergency Equipment', Component: 'Fire Extinguishers' },
              { System: 'Plumbing and Sanitary System', Component: 'Piping Network' },
              { System: 'Rainwater Harvesting System', Component: 'Filtration Unit' },
              { System: 'Solar Energy Generation System', Component: 'Solar Inverter' },
              { System: 'Stormwater Drainage System', Component: 'Drainage & Waste' },
              { System: 'Architectural, Civil and Structural System', Component: 'Masonry & Tiles' },
              { System: 'Engineering Tools and Equipment', Component: 'Power Tools' },
              { System: 'Professional/Consultancy Fee', Component: 'Advisory Services' },
              { System: 'Communication System', Component: 'Intercom & Paging' },
              { System: 'Auxiliary Sytem', Component: 'Structured Cabling' }
            ]
          };

          resolve({ headers: [], records: mockTables[table] || [] });
          break;
        }

        case 'config:saveRecord':
          resolve({ success: true, table: payload.table, record: payload.record });
          break;

        case 'config:deleteRecord':
          resolve({ success: true, table: payload.table, id: payload.id });
          break;

        case 'transaction:getHistory':
          resolve([
            {
              transactionId: 'TXN-2026-0001',
              timestamp: '2026-09-28 10:15:00',
              transactionType: 'IN:MRL',
              sourceType: 'MRL',
              sourceRefId: 'MRL-6506',
              destinationType: 'INVENTORY',
              destinationRefId: 'FACILITIES_WAREHOUSE_MAIN',
              loggedById: 'custodian@jjjei.com',
              accountablePartyId: 'custodian@jjjei.com',
              status: 'POSTED',
              remarks: 'Physical delivery intake verified',
              items: [
                {
                  entryId: 'TXNI-0001',
                  itemId: 'ITM-0001',
                  itemSku: 'CNS-PLB-0001',
                  itemName: 'PPR Pipe 1/2" x 4m',
                  quantity: 45,
                  uom: 'pc',
                  unitCost: 345.5,
                  totalCost: 15547.5
                }
              ]
            }
          ]);
          break;

        case 'incident:getQueue':
          resolve([
            {
              lossId: 'LOSS-2026-0001',
              incidentDate: '2026-09-27 14:20:00',
              lossType: 'DAMAGE',
              originType: 'INVENTORY',
              originRefId: 'FACILITIES_WAREHOUSE_MAIN',
              liablePartyId: 'technician.m@jjjei.com',
              approvalStatus: 'PENDING_APPROVAL',
              incidentDescription: 'PPR pipe bundles cracked during forklift transit maneuver.',
              attachmentUrl: '',
              items: [
                {
                  lineId: 'LOSSL-0001',
                  lossId: 'LOSS-2026-0001',
                  itemId: 'ITM-0001',
                  sku: 'CNS-PLB-0001',
                  name: 'PPR Pipe 1/2" x 4m',
                  quantity: 5,
                  uom: 'pc',
                  unitCost: 345.5,
                  deductionCost: 1727.5
                }
              ]
            }
          ]);
          break;

        case 'incident:approve':
          resolve({ lossId: payload.lossId, approvalStatus: 'APPROVED', transactionId: 'TXN-2026-0089' });
          break;

        case 'incident:reject':
          resolve({ lossId: payload.lossId, approvalStatus: 'REJECTED' });
          break;

        case 'custody:getList':
          resolve([
            {
              Custody_ID: 'CUST-2026-0001',
              Custodian_ID: 'mark.santos@jjjei.com',
              Custodian_Name: 'Mark Santos',
              Item_ID: 'ITM-0004',
              Item_SKU: 'TLS-PWR-0001',
              Item_Name: 'Cordless Rotary Hammer Drill 18V',
              Serial_Number: 'SN-DEW-2024-0089',
              Quantity: 1,
              UOM: 'unit',
              Date_Assigned: '2026-02-01',
              Status: 'ACTIVE',
              Last_Transaction_ID: 'TXN-2026-0012',
              Remarks: 'Issued with hard carry case and 2x 4.0Ah battery packs'
            },
            {
              Custody_ID: 'CUST-2026-0002',
              Custodian_ID: 'ramon.reyes@jjjei.com',
              Custodian_Name: 'Ramon Reyes',
              Item_ID: 'ITM-0005',
              Item_SKU: 'TLS-TST-0002',
              Item_Name: 'Digital Multimeter True RMS CAT III',
              Serial_Number: 'SN-FLU-2025-0142',
              Quantity: 1,
              UOM: 'unit',
              Date_Assigned: '2026-02-15',
              Status: 'ACTIVE',
              Last_Transaction_ID: 'TXN-2026-0018',
              Remarks: 'Calibrated through Nov 2026'
            }
          ]);
          break;

        case 'custody:transfer':
          resolve({
            transactionId: 'TXN-2026-0095',
            status: 'POSTED',
            message: 'Custody transferred successfully.'
          });
          break;

        case 'custody:retrieve':
          resolve({
            custodyId: payload.custodyId,
            transactionId: 'TXN-2026-0096',
            status: 'RETURNED'
          });
          break;

        case 'activity:getAll':
          resolve([
            {
              Activity_ID: 'ACT-2026-0001',
              Activity_Name: 'Tower A Chiller Compressor Overhaul',
              Activity_Type: 'PM',
              Site_Location: 'Tower A - 4th Floor Plant Room',
              Start_Date: '2026-03-01',
              Target_End_Date: '2026-04-15',
              Site_Supervisor_ID: 'engineer.lead@jjjei.com',
              Allocated_Budget: 150000,
              Current_Net_Cost: 45230,
              Status: 'ACTIVE'
            },
            {
              Activity_ID: 'ACT-2026-0002',
              Activity_Name: 'Phase 2 Emergency Generator Servicing',
              Activity_Type: 'CM',
              Site_Location: 'Powerhouse Substation Yard',
              Start_Date: '2026-03-10',
              Target_End_Date: '2026-03-25',
              Site_Supervisor_ID: 'elect.lead@jjjei.com',
              Allocated_Budget: 80000,
              Current_Net_Cost: 73500,
              Status: 'ACTIVE'
            }
          ]);
          break;

        case 'activity:getItems':
          resolve([
            {
              Activity_Line_ID: 'ACTL-2026-0001',
              Activity_ID: payload.activityId || 'ACT-2026-0001',
              Item_ID: 'ITM-0001',
              Item_SKU: 'CNS-PLB-0001',
              Item_Name: 'PPR Pipe 1/2" x 4m',
              Serial_Number_Class: 'N/A',
              Qty_Issued: 20,
              Qty_Returned: 2,
              Net_Used: 18,
              Qty_Expended: 12,
              UOM: 'pc',
              Unit_Cost_Billed_Cost: 345.5,
              Item_Tracking_State: 'PARTIAL_USED'
            },
            {
              Activity_Line_ID: 'ACTL-2026-0002',
              Activity_ID: payload.activityId || 'ACT-2026-0001',
              Item_ID: 'ITM-0002',
              Item_SKU: 'CNS-PLB-0002',
              Item_Name: 'PPR Equal Tee 1/2"',
              Serial_Number_Class: 'N/A',
              Qty_Issued: 30,
              Qty_Returned: 0,
              Net_Used: 30,
              Qty_Expended: 30,
              UOM: 'pc',
              Unit_Cost_Billed_Cost: 48.0,
              Item_Tracking_State: 'CONSUMED'
            }
          ]);
          break;

        case 'inventory:intakeMrl':
          resolve({
            mrlNumber: payload.mrlNumber || 'MRL-2026-6506',
            transactionId: 'TXN-2026-0033',
            mrtNumber: 'MRT-2026-0033',
            verifiedCount: Array.isArray(payload.items) ? payload.items.length : 1,
            rejectedCount: 0
          });
          break;

        case 'inventory:dispatch':
          resolve({
            transactionId: 'TXN-2026-0044',
            activityId: payload.activityId,
            itemsDispatched: Array.isArray(payload.items) ? payload.items.length : 1
          });
          break;

        case 'inventory:logConsumption':
          resolve({
            consumptionId: 'CNSM-2026-0001',
            transactionId: 'TXN-2026-0045',
            activityId: payload.activityId,
            itemId: payload.itemId,
            quantityExpended: payload.quantityExpended,
            currentNetCost: 52000
          });
          break;

        case 'inventory:logDirectConsumption':
          resolve({
            consumptionId: 'CNSM-2026-0002',
            transactionId: 'TXN-2026-0099',
            scope: payload.scope || 'WAREHOUSE',
            itemId: payload.itemId,
            quantity: payload.quantity,
            totalCost: Number(payload.quantity || 1) * 345.50
          });
          break;

        case 'inventory:getConsumedItems':
          resolve([
            {
              Consumption_ID: 'CNSM-2026-0001',
              Timestamp: '2026-03-20 14:15:00',
              Consumption_Scope: 'ACTIVITY',
              Reference_ID: payload.referenceId || 'ACT-2026-0001',
              Reference_Name: 'Tower A Chiller Compressor Overhaul',
              Item_ID: 'ITM-0001',
              Item_SKU: 'CNS-PLB-0001',
              Item_Name: 'PPR Pipe 1/2" x 4m',
              Serial_Number: 'N/A',
              Classification: 'CNS',
              Quantity: 6,
              UOM: 'pc',
              Unit_Cost: 345.5,
              Total_Cost: 2073,
              Purpose: 'Cooling Loop Line Replacement',
              Work_Description: 'Installed on 4th floor chiller chilled water feed network',
              Logged_By_ID: 'custodian@jjjei.com',
              Accountable_Party_ID: 'engineer.lead@jjjei.com',
              Transaction_ID: 'TXN-2026-0045',
              Status: 'POSTED',
              Remarks: 'Verified by site inspector'
            },
            {
              Consumption_ID: 'CNSM-2026-0002',
              Timestamp: '2026-03-18 10:30:00',
              Consumption_Scope: 'WAREHOUSE',
              Reference_ID: 'FACILITIES_WAREHOUSE_MAIN',
              Reference_Name: 'Central Facilities Depot',
              Item_ID: 'ITM-0001',
              Item_SKU: 'CNS-PLB-0001',
              Item_Name: 'PPR Pipe 1/2" x 4m',
              Serial_Number: 'N/A',
              Classification: 'CNS',
              Quantity: 2,
              UOM: 'pc',
              Unit_Cost: 345.5,
              Total_Cost: 691,
              Purpose: 'Depot Water Supply Repair',
              Work_Description: 'Replaced cracked intake manifold at warehouse washing bay',
              Logged_By_ID: 'custodian@jjjei.com',
              Accountable_Party_ID: 'custodian@jjjei.com',
              Transaction_ID: 'TXN-2026-0099',
              Status: 'POSTED',
              Remarks: 'Depot internal maintenance'
            }
          ]);
          break;

        case 'inventory:returnSurplus':
          resolve({
            transactionId: 'TXN-2026-0046',
            activityId: payload.activityId,
            itemsReturned: Array.isArray(payload.items) ? payload.items.length : 1
          });
          break;

        case 'inventory:deployTool':
          resolve({
            transactionId: 'TXN-2026-0047',
            custodianId: payload.custodianId,
            toolsDeployed: Array.isArray(payload.items) ? payload.items.length : 1
          });
          break;

        case 'rollover:execute':
          resolve({
            previousYear: payload.previousYear || 2025,
            newYear: payload.newYear || 2026,
            newSheetId: 'mock-sheet-id-2026',
            newSheetUrl: 'https://docs.google.com/spreadsheets/d/mock-sheet-id-2026/edit',
            carriedWarehouseCount: 42
          });
          break;

        case 'transaction:prepare':
          resolve({
            transactionId: 'TXN-2026-0048',
            status: 'PENDING'
          });
          break;

        case 'transaction:commit':
          resolve({
            transactionId: payload.transactionId || 'TXN-2026-0048',
            status: 'POSTED'
          });
          break;

        case 'transaction:cancel':
          resolve({
            transactionId: payload.transactionId || 'TXN-2026-0048',
            status: 'VOIDED'
          });
          break;

        case 'incident:report':
          resolve({
            lossId: 'LOSS-2026-0010',
            approvalStatus: 'PENDING_APPROVAL'
          });
          break;

        case 'incident:recover':
          resolve({
            lossId: payload.lossId,
            transactionId: 'TXN-2026-0097',
            status: 'RECOVERED',
            recoveredItemsCount: 1
          });
          break;

        default:
          resolve({ success: true, message: `Action ${action} executed.` });
      }
    }, 250);
  });
}
