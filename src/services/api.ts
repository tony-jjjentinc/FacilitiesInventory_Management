/**
 * @file api.ts
 * @description Standardized HTTP client communicating with the Google Apps Script Web App
 * utilizing the JJJEI CORS-bypass transport protocol (text/plain;charset=utf-8).
 */

import type { ApiResponse } from '../types';
import { getStoredToken } from './auth';

const API_URL = import.meta.env.VITE_GAS_API_URL || '';

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
    throw new Error(result.error || result.errorCode || 'Unknown API error occurred.');
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
              { ID: 'ITM-0001', SKU: 'CNS-PLB-0001', Name: 'PPR Pipe 1/2" x 4m', Brand: 'ERA', Model: 'PN20', Variant: 'Green', Category_ID: 'PLB', Category_Name: 'Plumbing Supplies', Inventory_Type_Code: 'CNS', UOM: 'pc', Status: 'ACTIVE', Properties_JSON: '{"pressure_rating": "20 bar", "material": "Polypropylene Random"}', Fingerprint: 'FGP-001', Search_Tags: 'ppr, pipe, plumbing, water' },
              { ID: 'ITM-0045', SKU: 'TLS-PWR-0045', Name: 'Cordless Impact Driver 18V', Brand: 'Dewalt', Model: 'DCF887N', Variant: 'Bare Tool', Category_ID: 'PWR', Category_Name: 'Power Tools', Inventory_Type_Code: 'TLS', UOM: 'set', Status: 'ACTIVE', Properties_JSON: '{"torque": "205 Nm", "voltage": "18V"}', Fingerprint: 'FGP-045', Search_Tags: 'dewalt, impact, driver, power tool' }
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

        default:
          resolve({ success: true, message: `Action ${action} executed.` });
      }
    }, 250);
  });
}
