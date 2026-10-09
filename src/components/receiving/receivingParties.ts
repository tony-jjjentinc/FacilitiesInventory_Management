/**
 * Receiving parties offered in the dropdown. DUMMY accounts for now: the real list will come from the user directory.
 * A receipt is confirmed by logging in as the chosen account, so a dummy account cannot confirm anything.
 */
export interface ReceivingPartyOption { email: string; name: string; role: string }

export const DUMMY_RECEIVING_PARTIES: ReceivingPartyOption[] = [
  { email: 'maria.santos@jjjei.com', name: 'Maria Santos', role: 'Warehouse Custodian' },
  { email: 'jose.reyes@jjjei.com', name: 'Jose Reyes', role: 'Site Supervisor' },
  { email: 'ana.cruz@jjjei.com', name: 'Ana Cruz', role: 'Facilities Engineer' },
  { email: 'pedro.garcia@jjjei.com', name: 'Pedro Garcia', role: 'Maintenance Lead' },
  { email: 'liza.mendoza@jjjei.com', name: 'Liza Mendoza', role: 'Inventory Clerk' }
];
