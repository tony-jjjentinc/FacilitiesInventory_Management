import { invalidateCache } from '../../services/cache';

export interface SubmitResult {
  receiptId: string;
  receiverId: string;
  verifiedCount: number;
  rejectedCount?: number;
  /** auto-receive: the stock was posted as part of the submit */
  confirmed?: boolean;
  confirmError?: string;
  transactionId?: string | null;
  mrtNumber?: string | null;
}

type Toaster = { success: (m: string) => void; warning: (m: string) => void };

/** Toast for a submitted receipt, and a cache refresh when the stock was posted straight away (auto-receive). */
export function notifySubmit(res: SubmitResult, toast: Toaster): void {
  if (res.confirmed) {
    invalidateCache('inventory:stock');
    invalidateCache('transaction:history');
    invalidateCache('activity');
    toast.success(`Receipt ${res.receiptId} submitted and received.${res.transactionId ? ` Transaction ${res.transactionId}.` : ''}${res.mrtNumber ? ` MRT ${res.mrtNumber}.` : ''}`);
  } else if (res.confirmError) {
    toast.warning(`Receipt ${res.receiptId} was submitted but could not be received automatically: ${res.confirmError} It is waiting in Pending confirmation.`);
  } else {
    toast.success(`Receipt ${res.receiptId} submitted. Waiting for ${res.receiverId} to confirm.`);
  }
}

/** The line shown in the green banner after a submit. */
export function submitStatusText(res: SubmitResult): string {
  if (res.confirmed) return 'Received into the inventory.';
  if (res.confirmError) return 'Could not be received automatically; it is waiting in Pending confirmation.';
  return `Waiting for ${res.receiverId} to confirm.`;
}
