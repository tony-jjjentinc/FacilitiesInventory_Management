import React from 'react';
import { useParams } from 'react-router-dom';
import { EntityPage } from '../../components/entity/EntityPage';
import { ActivityOverviewTab } from '../../components/entity/ActivityOverviewTab';
import { ActivityUsageTab } from '../../components/entity/ActivityUsageTab';
import { TimelineTab } from '../../components/entity/TimelineTab';

/** /activities/:id */
export const ActivityPage: React.FC = () => {
  const { id = '' } = useParams();
  return (
    <EntityPage scopeType="ACTIVITY" scopeRef={id} backTo={{ path: '/activities', label: 'All activities' }} tabs={[
      { key: 'overview', label: 'Overview', render: (_p, open) => <ActivityOverviewTab activityId={id} onOpenTab={open} /> },
      { key: 'usage', label: 'Inventory Stock Usage', render: () => <ActivityUsageTab activityId={id} /> },
      { key: 'timeline', label: 'Timeline', render: () => <TimelineTab scopeType="ACTIVITY" scopeRef={id} /> }
    ]} />
  );
};
