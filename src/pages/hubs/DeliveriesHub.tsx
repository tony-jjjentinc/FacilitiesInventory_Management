import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabBar, useTabParam } from '../../components/TabBar';
import { ManualReceiving } from '../../components/receiving/ManualReceiving';
import { MrlReceiving } from '../../components/receiving/MrlReceiving';
import { PendingConfirmations } from '../../components/receiving/PendingConfirmations';
import { useReceivingLookups } from '../../components/receiving/useReceivingLookups';
import { prefetchMrls } from '../../components/receiving/useMrlList';
import { useToast } from '../../context/ToastContext';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { DELIVERIES_COUNT_EVENT } from '../../services/api';
import { AssignQueue, Assignments } from '../../components/receiving/Assignments';
import { MrtList } from '../../components/receiving/MrtList';
import { useAssignmentMode } from '../../components/receiving/useAssignmentMode';

/**
 * Deliveries: everything about stock coming in, apart from looking at the stock itself (that stays in Inventory).
 *   My tasks        what is waiting for me: assignments to verify, delegated deliveries, receipts to confirm and to price
 *   MRLs to assign  Heads: released MRLs waiting for a Sub-Department verifier (assignment mode)
 *   Material Release / New Inventory   the receiving forms (Material Release only when assignments are off)
 *   Returns to ProcInv   items sent back, with their status
 * The task lists and forms stay mounted so an unfinished form survives switching tabs, and the counts stay current.
 */
const keysFor = (custodian: boolean, field: boolean, admin: boolean, assignment: boolean) => {
  if (custodian) return ['tasks', ...(assignment ? (admin ? ['assign'] : []) : ['receive-mrl']), 'receive-manual', 'returns'];
  if (field) return ['tasks'];
  return ['tasks'];
};

export const DeliveriesHub: React.FC = () => {
  const access = getAccess(getCurrentUser());
  const { assignment, tasks, known } = useAssignmentMode();
  const showTasks = assignment || tasks; // open tasks stay reachable after the switch is turned off
  const [tab, setTab] = useTabParam(keysFor(access.isCustodian, access.canField, access.isAdmin, assignment));
  const [myTasks, setMyTasks] = useState(0);
  const [awaitingMe, setAwaitingMe] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const lookups = useReceivingLookups(access.isCustodian);
  const toast = useToast();
  useEffect(() => { if (lookups.error) toast.error(lookups.error); }, [lookups.error, toast]);
  const onCountChange = useCallback((n: number) => setAwaitingMe(n), []);
  const submitted = () => { setRefreshKey(k => k + 1); prefetchMrls(); };

  // old links to the Material Release tab (dashboard, search, bookmarks) land on the tab that replaces it when assignments are on
  const [params] = useSearchParams();
  useEffect(() => {
    if (assignment && params.get('tab') === 'receive-mrl') setTab(access.isAdmin ? 'assign' : 'tasks');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment, params]);

  // tell the nav badge how much is waiting, as soon as the lists know
  useEffect(() => { window.dispatchEvent(new CustomEvent(DELIVERIES_COUNT_EVENT, { detail: { tasks: myTasks, pending: awaitingMe } })); }, [myTasks, awaitingMe]);
  // keep a saved copy of the MRL list ready, so Browse MRLs opens with data already there
  useEffect(() => { if (access.isCustodian) prefetchMrls(); }, [access.isCustodian]);

  const waiting = myTasks + awaitingMe;
  return (
    <>
      <TabBar
        label="Deliveries" active={tab} onChange={setTab}
        tabs={[
          { key: 'tasks', label: 'My tasks', badge: waiting },
          ...(assignment && access.isAdmin ? [{ key: 'assign', label: 'MRLs to assign' }] : []),
          ...(access.isCustodian && known && !assignment ? [{ key: 'receive-mrl', label: 'Material Release' }] : []),
          ...(access.isCustodian ? [{ key: 'receive-manual', label: 'New Inventory' }, { key: 'returns', label: 'Returns to ProcInv' }] : [])
        ]}
      />
      {/* The task lists and the forms stay mounted so counts stay current and an unfinished form survives switching tabs */}
      <div className="container py-4 px-3 px-md-4">
        {assignment && access.isAdmin && tab === 'assign' && <AssignQueue onAssigned={() => { setRefreshKey(k => k + 1); setTab('tasks'); }} />}
        <div className={tab === 'tasks' ? 'd-flex flex-column gap-3' : 'd-none'}>
          {showTasks && access.canField && <Assignments refreshKey={refreshKey} onChanged={() => setRefreshKey(k => k + 1)} onCount={setMyTasks} />}
          {access.canField && <PendingConfirmations active={tab === 'tasks'} refreshKey={refreshKey} onCountChange={onCountChange} />}
        </div>
        {access.isCustodian && tab === 'returns' && <MrtList />}
        {access.isCustodian && (
          <>
            {known && !assignment && <div className={tab === 'receive-mrl' ? '' : 'd-none'}>
              <MrlReceiving lookups={lookups} onSubmitted={submitted} onViewPending={() => setTab('tasks')} />
            </div>}
            <div className={tab === 'receive-manual' ? '' : 'd-none'}>
              <ManualReceiving lookups={lookups} onSubmitted={submitted} onViewPending={() => setTab('tasks')} />
            </div>
          </>
        )}
      </div>
    </>
  );
};
