import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { EntityPage } from '../../components/entity/EntityPage';
import { SubDepartmentOverviewTab } from '../../components/entity/SubDepartmentOverviewTab';
import { SubDepartmentCustodyTab } from '../../components/entity/SubDepartmentCustodyTab';
import { SubDepartmentActivitiesTab, SubDepartmentLossTab, SubDepartmentPeopleTab } from '../../components/entity/SubDepartmentExtraTabs';
import { TimelineTab } from '../../components/entity/TimelineTab';

/** /sub-departments/:name */
export const SubDepartmentPage: React.FC = () => {
  const { id: name = '' } = useParams();
  const [, setParams] = useSearchParams();
  const open = (key: string) => setParams(key === 'overview' ? {} : { tab: key }, { replace: true });
  return (
    <EntityPage scopeType="SUBDEPARTMENT" scopeRef={name} backTo={{ path: '/sub-departments', label: 'All sub-departments' }} tabs={[
      { key: 'overview', label: 'Overview', render: () => <SubDepartmentOverviewTab name={name} onOpenTab={open} /> },
      { key: 'custody', label: 'Inventory Item Custody', render: () => <SubDepartmentCustodyTab name={name} /> },
      { key: 'activities', label: 'Activities', render: () => <SubDepartmentActivitiesTab name={name} /> },
      { key: 'loss', label: 'Loss / Write-offs', render: () => <SubDepartmentLossTab name={name} /> },
      { key: 'people', label: 'People', render: () => <SubDepartmentPeopleTab name={name} /> },
      { key: 'timeline', label: 'Timeline', render: () => <TimelineTab scopeType="SUBDEPARTMENT" scopeRef={name} /> }
    ]} />
  );
};
