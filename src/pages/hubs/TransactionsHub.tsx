import React, { useCallback, useEffect, useState } from 'react';
import { TabBar, useTabParam } from '../../components/TabBar';
import { Transactions } from '../Transactions';
import { ManualReceiving } from '../../components/receiving/ManualReceiving';
import { MrlReceiving } from '../../components/receiving/MrlReceiving';
import { PendingConfirmations } from '../../components/receiving/PendingConfirmations';
import { useReceivingLookups } from '../../components/receiving/useReceivingLookups';
import { prefetchMrls } from '../../components/receiving/useMrlList';

const KEYS = ['receive-mrl', 'receive-manual', 'pending', 'ledger'];

export const TransactionsHub: React.FC = () => {
  const [tab, setTab] = useTabParam(KEYS);
  const lookups = useReceivingLookups();
  const [awaitingMe, setAwaitingMe] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const onCountChange = useCallback((n: number) => setAwaitingMe(n), []);
  const submitted = () => { setRefreshKey(k => k + 1); prefetchMrls(); };

  // keep a saved copy of the MRL list ready, so Browse MRLs opens with data already there
  useEffect(() => { prefetchMrls(); }, []);

  return (
    <>
      <TabBar
        label="Transactions" active={tab} onChange={setTab}
        tabs={[
          { key: 'receive-mrl', label: 'Receive (MRL)' },
          { key: 'receive-manual', label: 'Receive (Manual)' },
          { key: 'pending', label: 'Pending confirmation', badge: awaitingMe },
          { key: 'ledger', label: 'Ledger' }
        ]}
      />
      {/* The receiving tabs stay mounted so an unfinished form survives switching tabs */}
      <div className="container py-4 px-3 px-md-4">
        <div className={tab === 'receive-mrl' ? '' : 'd-none'}>
          <MrlReceiving lookups={lookups} onSubmitted={submitted} onViewPending={() => setTab('pending')} />
        </div>
        <div className={tab === 'receive-manual' ? '' : 'd-none'}>
          <ManualReceiving lookups={lookups} onSubmitted={submitted} onViewPending={() => setTab('pending')} />
        </div>
        <div className={tab === 'pending' ? '' : 'd-none'}>
          <PendingConfirmations active={tab === 'pending'} refreshKey={refreshKey} onCountChange={onCountChange} />
        </div>
      </div>
      {tab === 'ledger' && <Transactions />}
    </>
  );
};
