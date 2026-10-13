import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabBar, useTabParam } from '../../components/TabBar';
import { WarehouseStock } from '../WarehouseStock';
import { MasterCatalog } from '../MasterCatalog';
import { CustodyRegister } from '../CustodyRegister';
import { RopAlertCenter } from '../RopAlertCenter';
import { WarehousesIndex } from '../entity/WarehousesIndex';
import { ManualReceiving } from '../../components/receiving/ManualReceiving';
import { MrlReceiving } from '../../components/receiving/MrlReceiving';
import { PendingConfirmations } from '../../components/receiving/PendingConfirmations';
import { useReceivingLookups } from '../../components/receiving/useReceivingLookups';
import { prefetchMrls } from '../../components/receiving/useMrlList';
import { useToast } from '../../context/ToastContext';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';
import { AssignQueue, Assignments } from '../../components/receiving/Assignments';
import { MrtList } from '../../components/receiving/MrtList';
import { useAssignmentMode } from '../../components/receiving/useAssignmentMode';

/**
 * Stock tabs first, then the receiving tabs by role. With MRL assignments on, MRLs are received through a Head's assignment
 * (MRLs to assign, then Assignments) and the Material Release tab is gone; New Inventory stays for custodians. Anyone who can
 * confirm a receipt sees Confirmation.
 */
const STOCK = ['warehouse', 'catalog', 'custody', 'alerts', 'warehouses'];
const keysFor = (custodian: boolean, field: boolean, admin: boolean, assignment: boolean, tasks: boolean) => {
  const mine = tasks ? ['assignments'] : [];
  if (custodian) return STOCK.concat(assignment
    ? ['returns', 'receive-manual', ...(admin ? ['assign'] : []), 'assignments', 'pending']
    : ['receive-mrl', 'returns', 'receive-manual', ...mine, 'pending']);
  if (field) return STOCK.concat(assignment ? ['assignments', 'pending'] : [...mine, 'pending']);
  return STOCK;
};

export const InventoryStockHub: React.FC = () => {
  const access = getAccess(getCurrentUser());
  const { assignment, tasks } = useAssignmentMode();
  const showTasks = assignment || tasks; // open tasks stay reachable after the switch is turned off
  const [tab, setTab] = useTabParam(keysFor(access.isCustodian, access.canField, access.isAdmin, assignment, showTasks));
  const [myTasks, setMyTasks] = useState(0);
  // old links to the Material Release tab (dashboard, search, bookmarks) land on the tab that replaces it when assignments are on
  const [params] = useSearchParams();
  useEffect(() => {
    if (assignment && params.get('tab') === 'receive-mrl') setTab(access.isAdmin ? 'assign' : 'assignments');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment, params]);
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
        label="Inventory" active={tab} onChange={setTab}
        tabs={[
          { key: 'warehouse', label: 'Warehouse Stock' },
          { key: 'catalog', label: 'Inventory Catalog' },
          { key: 'custody', label: 'Tool Custody' },
          { key: 'alerts', label: 'Reorder Alerts' },
          { key: 'warehouses', label: 'Warehouses' },
          ...(access.isCustodian && !assignment ? [{ key: 'receive-mrl', label: 'Material Release' }] : []),
          ...(access.isCustodian ? [{ key: 'returns', label: 'Material Returns' }, { key: 'receive-manual', label: 'New Inventory' }] : []),
          ...(assignment && access.isAdmin ? [{ key: 'assign', label: 'MRLs to assign' }] : []),
          ...(showTasks && access.canField ? [{ key: 'assignments', label: 'Assignments', badge: myTasks }] : []),
          ...(access.canField ? [{ key: 'pending', label: 'Confirmation', badge: awaitingMe }] : [])
        ]}
      />
      {tab === 'warehouse' && <WarehouseStock />}
      {tab === 'catalog' && <MasterCatalog />}
      {tab === 'custody' && <CustodyRegister />}
      {tab === 'alerts' && <RopAlertCenter />}
      {tab === 'warehouses' && <WarehousesIndex />}
      {/* The receiving tabs stay mounted so an unfinished form survives switching tabs */}
      <div className="container py-4 px-3 px-md-4">
        {assignment && access.isAdmin && tab === 'assign' && <AssignQueue onAssigned={() => { setRefreshKey(k => k + 1); setTab('assignments'); }} />}
        {showTasks && access.canField && <div className={tab === 'assignments' ? '' : 'd-none'}><Assignments refreshKey={refreshKey} onChanged={() => setRefreshKey(k => k + 1)} onCount={setMyTasks} /></div>}
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
      </div>
    </>
  );
};
