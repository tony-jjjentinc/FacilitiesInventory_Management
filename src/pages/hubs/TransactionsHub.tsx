import React, { useCallback, useEffect, useState } from 'react';
import { TabBar, useTabParam } from '../../components/TabBar';
import { Transactions } from '../Transactions';
import { ManualReceiving } from '../../components/receiving/ManualReceiving';
import { MrlReceiving } from '../../components/receiving/MrlReceiving';
import { PendingConfirmations } from '../../components/receiving/PendingConfirmations';
import { useReceivingLookups } from '../../components/receiving/useReceivingLookups';
import { prefetchMrls } from '../../components/receiving/useMrlList';
import { useToast } from '../../context/ToastContext';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { apiRequest } from '../../services/api';
import { fetchWithSwr, getCachedData } from '../../services/cache';
import { AssignQueue, Assignments } from '../../components/receiving/Assignments';
import { MrqTracker, MrtList } from '../../components/receiving/MrqTracker';

/**
 * Tabs by role. With MRL assignments on, MRLs are received through a Head's assignment (Assign, then Assignments) and the
 * Receive (MRL) tab is gone; Receive (Manual) stays for custodians. Anyone who can confirm a receipt sees Pending; the ledger is for everyone.
 */
const keysFor = (custodian: boolean, field: boolean, admin: boolean, assignment: boolean, tasks: boolean) => {
  const mine = tasks ? ['assignments'] : [];
  if (custodian) return assignment
    ? [...(admin ? ['assign'] : []), 'assignments', 'receive-manual', 'pending', 'tracker', 'returns', 'ledger']
    : ['receive-mrl', ...mine, 'receive-manual', 'pending', 'tracker', 'returns', 'ledger'];
  if (field) return assignment ? ['assignments', 'pending', 'tracker', 'ledger'] : [...mine, 'pending', 'tracker', 'ledger'];
  return ['ledger'];
};

/** Whether MRLs are received through assignments (the MRL_ASSIGNMENT switch on the server). */
function useAssignmentMode(): { assignment: boolean; tasks: boolean } {
  const [on, setOn] = useState(() => !!getCachedData<{ assignment: boolean }>('receiving:mode')?.assignment);
  const [tasks, setTasks] = useState(() => !!getCachedData<{ tasks: boolean }>('receiving:mode')?.tasks);
  useEffect(() => {
    let alive = true;
    fetchWithSwr<{ assignment: boolean; tasks: boolean }>('receiving:mode', () => apiRequest('receiving:getMode'), d => { if (alive && d) { setOn(!!d.assignment); setTasks(!!d.tasks); } }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return { assignment: on, tasks };
}

export const TransactionsHub: React.FC = () => {
  const access = getAccess(getCurrentUser());
  const { assignment, tasks } = useAssignmentMode();
  const showTasks = assignment || tasks; // open tasks stay reachable after the switch is turned off
  const [tab, setTab] = useTabParam(keysFor(access.isCustodian, access.canField, access.isAdmin, assignment, showTasks));
  const [myTasks, setMyTasks] = useState(0);
  const lookups = useReceivingLookups(access.isCustodian);
  const toast = useToast();
  useEffect(() => { if (lookups.error) toast.error(lookups.error); }, [lookups.error, toast]);
  const [awaitingMe, setAwaitingMe] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const onCountChange = useCallback((n: number) => setAwaitingMe(n), []);
  const submitted = () => { setRefreshKey(k => k + 1); prefetchMrls(); };

  // keep a saved copy of the MRL list ready, so Browse MRLs opens with data already there
  useEffect(() => { if (access.isCustodian) prefetchMrls(); }, [access.isCustodian]);

  return (
    <>
      <TabBar
        label="Transactions" active={tab} onChange={setTab}
        tabs={[
          ...(assignment && access.isAdmin ? [{ key: 'assign', label: 'MRLs to assign' }] : []),
          ...(showTasks && access.canField ? [{ key: 'assignments', label: 'Assignments', badge: myTasks }] : []),
          ...(access.isCustodian && !assignment ? [{ key: 'receive-mrl', label: 'Receive (MRL)' }] : []),
          ...(access.isCustodian ? [{ key: 'receive-manual', label: 'Receive (Manual)' }] : []),
          ...(access.canField ? [{ key: 'pending', label: 'Pending confirmation', badge: awaitingMe }, { key: 'tracker', label: 'Material requests' }] : []),
          ...(access.isCustodian ? [{ key: 'returns', label: 'Returns (MRT)' }] : []),
          { key: 'ledger', label: 'Ledger' }
        ]}
      />
      {/* The receiving tabs stay mounted so an unfinished form survives switching tabs */}
      <div className="container py-4 px-3 px-md-4">
        {assignment && access.isAdmin && tab === 'assign' && <AssignQueue onAssigned={() => { setRefreshKey(k => k + 1); setTab('assignments'); }} />}
        {showTasks && access.canField && <div className={tab === 'assignments' ? '' : 'd-none'}><Assignments refreshKey={refreshKey} onChanged={() => setRefreshKey(k => k + 1)} onCount={setMyTasks} /></div>}
        {access.canField && tab === 'tracker' && <MrqTracker />}
        {access.isCustodian && tab === 'returns' && <MrtList />}
        {access.isCustodian && (
          <>
            {!assignment && <div className={tab === 'receive-mrl' ? '' : 'd-none'}>
              <MrlReceiving lookups={lookups} onSubmitted={submitted} onViewPending={() => setTab('pending')} />
            </div>}
            <div className={tab === 'receive-manual' ? '' : 'd-none'}>
              <ManualReceiving lookups={lookups} onSubmitted={submitted} onViewPending={() => setTab('pending')} />
            </div>
          </>
        )}
        {access.canField && (
          <div className={tab === 'pending' ? '' : 'd-none'}>
            <PendingConfirmations active={tab === 'pending'} refreshKey={refreshKey} onCountChange={onCountChange} />
          </div>
        )}
        {tab === 'ledger' && <Transactions />}
      </div>
    </>
  );
};
