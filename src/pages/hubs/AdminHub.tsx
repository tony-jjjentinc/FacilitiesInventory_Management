import React from 'react';
import { TabBar, useTabParam } from '../../components/TabBar';
import { ApprovalsQueue } from '../ApprovalsQueue';
import { SetPrice } from './CostViews';

const KEYS = ['approvals', 'price'];

export const AdminHub: React.FC<{ pendingApprovals?: number }> = ({ pendingApprovals }) => {
  const [tab, setTab] = useTabParam(KEYS);
  return (
    <>
      <TabBar
        label="Admin" active={tab} onChange={setTab}
        tabs={[{ key: 'approvals', label: 'Approvals', badge: pendingApprovals }, { key: 'price', label: 'Set Price' }]}
      />
      {tab === 'approvals' && <ApprovalsQueue />}
      {tab === 'price' && <div className="container py-4 px-3 px-md-4"><SetPrice /></div>}
    </>
  );
};
