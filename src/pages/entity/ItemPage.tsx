import React from 'react';
import { useParams } from 'react-router-dom';
import { EntityPage } from '../../components/entity/EntityPage';
import { ItemOverviewTab } from '../../components/entity/ItemOverviewTab';
import { ItemDistributionTab } from '../../components/entity/ItemDistributionTab';
import { ConfigTab } from '../../components/entity/ConfigTab';
import { TimelineTab } from '../../components/entity/TimelineTab';

/** /items/:id */
export const ItemPage: React.FC = () => {
  const { id = '' } = useParams();
  return (
    <EntityPage scopeType="ITEM" scopeRef={id} backTo={{ path: '/inventory?tab=catalog', label: 'Inventory catalog' }} tabs={[
      { key: 'overview', label: 'Overview', render: () => <ItemOverviewTab itemId={id} /> },
      { key: 'distribution', label: 'Distribution', render: () => <ItemDistributionTab itemId={id} /> },
      { key: 'config', label: 'Configurations', render: p => <ConfigTab profile={p} /> },
      { key: 'timeline', label: 'Timeline', render: () => <TimelineTab scopeType="ITEM" scopeRef={id} /> }
    ]} />
  );
};
