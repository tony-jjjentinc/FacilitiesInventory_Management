import React from 'react';
import { useParams } from 'react-router-dom';
import { EntityPage } from '../../components/entity/EntityPage';
import { EntityOverviewTab } from '../../components/entity/EntityOverviewTab';
import { ManageStorage } from '../../components/entity/ManageStorage';
import { StockTab } from '../../components/entity/StockTab';
import { WarehouseConfigTab } from '../../components/entity/WarehouseForm';
import { TimelineTab } from '../../components/entity/TimelineTab';

/** /warehouses/:id */
export const WarehousePage: React.FC = () => {
  const { id = '' } = useParams();
  return (
    <EntityPage scopeType="WAREHOUSE" scopeRef={id} backTo={{ path: '/warehouses', label: 'All warehouses' }} tabs={[
      { key: 'overview', label: 'Overview', render: (_p, open) => <EntityOverviewTab scopeType="WAREHOUSE" scopeRef={id} onOpenTab={open} /> },
      { key: 'areas', label: 'Manage Areas', render: () => <ManageStorage scopeType="WAREHOUSE" scopeRef={id} warehouseId={id} /> },
      { key: 'stock', label: 'Inventory Stock', render: () => <StockTab scopeType="WAREHOUSE" scopeRef={id} /> },
      { key: 'config', label: 'Configurations', render: (p, _open, reload) => <WarehouseConfigTab profile={p} reload={reload} /> },
      { key: 'timeline', label: 'Timeline', render: () => <TimelineTab scopeType="WAREHOUSE" scopeRef={id} /> }
    ]} />
  );
};
