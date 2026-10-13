import React from 'react';
import { TabBar, useTabParam } from '../../components/TabBar';
import { ProjectAllocation } from '../ProjectAllocation';
import { ConsumptionLog } from './ConsumptionLog';
import { SubDepartmentsIndex } from '../entity/SubDepartmentsIndex';

const KEYS = ['allocation', 'consumption', 'sub-departments'];

export const ActivitiesHub: React.FC = () => {
  const [tab, setTab] = useTabParam(KEYS);
  return (
    <>
      <TabBar label="Projects & Activities" active={tab} onChange={setTab} tabs={[{ key: 'allocation', label: 'Allocation' }, { key: 'consumption', label: 'Consumption Log' }, { key: 'sub-departments', label: 'Sub-Departments' }]} />
      {tab === 'allocation' && <ProjectAllocation />}
      {tab === 'consumption' && <ConsumptionLog />}
      {tab === 'sub-departments' && <SubDepartmentsIndex />}
    </>
  );
};
