import React from 'react';
import { useParams } from 'react-router-dom';
import { EntityPage } from '../../components/entity/EntityPage';
import { EntityOverviewTab } from '../../components/entity/EntityOverviewTab';
import { ManageStorage } from '../../components/entity/ManageStorage';
import { StockTab } from '../../components/entity/StockTab';
import { ConfigTab } from '../../components/entity/ConfigTab';
import { TimelineTab } from '../../components/entity/TimelineTab';

/** /areas/:id */
export const AreaPage: React.FC = () => {
  const { id = '' } = useParams();
  return (
    <EntityPage scopeType="AREA" scopeRef={id} backTo={{ path: '/warehouses', label: 'All warehouses' }} tabs={[
      { key: 'overview', label: 'Overview', render: (_p, open) => <EntityOverviewTab scopeType="AREA" scopeRef={id} onOpenTab={open} /> },
      { key: 'storage', label: 'Shelves and Containers', render: p => (
        <ManageStorage scopeType="AREA" scopeRef={id} warehouseId={p.parents[0]?.id || String(p.record['Warehouse_Location'] || '')} root={{ storageId: id, name: p.title }} />
      ) },
      { key: 'stock', label: 'Inventory Stock', render: () => <StockTab scopeType="AREA" scopeRef={id} showArea={false} /> },
      { key: 'config', label: 'Configurations', render: p => <ConfigTab profile={p} /> },
      { key: 'timeline', label: 'Timeline', render: () => <TimelineTab scopeType="AREA" scopeRef={id} /> }
    ]} />
  );
};
