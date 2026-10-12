import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr } from '../../services/cache';
import type { DirectoryAccount } from '../../types';
import { DUMMY_RECEIVING_PARTIES } from './receivingParties';

export interface PartyOption { email: string; label: string }

const describe = (a: DirectoryAccount) => a.name || a.email;

/**
 * People who can be the receiving party: the active accounts imported from the Accounts sheet.
 * Falls back to the sample list until the import has data. `sample` tells which one is in use.
 */
export function useAccountDirectory() {
  const [accounts, setAccounts] = useState<DirectoryAccount[]>([]);
  useEffect(() => {
    let alive = true;
    fetchWithSwr<DirectoryAccount[]>('accounts:directory', () => apiRequest<DirectoryAccount[]>('accounts:getDirectory'), d => { if (alive && Array.isArray(d)) setAccounts(d); })
      .catch(() => { /* keep the sample list */ });
    return () => { alive = false; };
  }, []);
  const sample = accounts.length === 0;
  const options: PartyOption[] = sample
    ? DUMMY_RECEIVING_PARTIES.map(p => ({ email: p.email, label: p.name }))
    : accounts.map(a => ({ email: a.email, label: describe(a) }));
  return { options, sample };
}
