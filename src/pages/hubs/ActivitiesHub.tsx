import React from 'react';
import { TabBar, useTabParam } from '../../components/TabBar';
import { ProjectAllocation } from '../ProjectAllocation';
import { ConsumptionLog } from './ConsumptionLog';

const KEYS = ['allocation', 'consumption'];

export const ActivitiesHub: React.FC = () => {
  const [tab, setTab] = useTabParam(KEYS);
  return (
    <>
      <TabBar label="Activities" active={tab} onChange={setTab} tabs={[{ key: 'allocation', label: 'Allocation' }, { key: 'consumption', label: 'Consumption Log' }]} />
      {tab === 'allocation' && <ProjectAllocation />}
      {tab === 'consumption' && <ConsumptionLog />}
    </>
  );
};
