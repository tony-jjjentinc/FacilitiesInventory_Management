/**
 * @file api.ts
 * @description Standardized HTTP client communicating with the Google Apps Script Web App
 * utilizing the JJJEI CORS-bypass transport protocol (text/plain;charset=utf-8).
 */

import type { ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_GAS_API_URL || '';

/**
 * Dispatches a POST request to the Google Apps Script Web App.
 */
export async function apiRequest<T = any>(action: string, payload: any = {}): Promise<T> {
  const token = sessionStorage.getItem('jjjei_jwt_token') || '';

  // Local sandbox mock fallback if no API_URL is provided in development
  if (!API_URL) {
    console.warn(`[API] VITE_GAS_API_URL not configured. Simulating '${action}' locally.`);
    return mockLocalResponse(action, payload);
  }

  const response = await fetch(API_URL, {
    method: 'POST',
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
        case 'auth:login':
          if (payload.password === 'error') {
            reject(new Error('AUTH_ERROR: Invalid credentials.'));
            return;
          }
          const mockJwt = 'mock.header.payload';
          resolve({ token: mockJwt });
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

        default:
          resolve({ success: true, message: `Action ${action} executed.` });
      }
    }, 250);
  });
}
