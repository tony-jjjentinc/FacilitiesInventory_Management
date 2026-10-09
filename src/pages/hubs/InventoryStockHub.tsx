import React from 'react';
import { TabBar, useTabParam } from '../../components/TabBar';
import { WarehouseStock } from '../WarehouseStock';
import { MasterCatalog } from '../MasterCatalog';
import { CustodyRegister } from '../CustodyRegister';
import { RopAlertCenter } from '../RopAlertCenter';

const KEYS = ['warehouse', 'catalog', 'custody', 'alerts'];

export const InventoryStockHub: React.FC = () => {
  const [tab, setTab] = useTabParam(KEYS);
  return (
    <>
      <TabBar
        label="Inventory" active={tab} onChange={setTab}
        tabs={[
          { key: 'warehouse', label: 'Warehouse Stock' },
          { key: 'catalog', label: 'Inventory Catalog' },
          { key: 'custody', label: 'Tool Custody' },
          { key: 'alerts', label: 'Reorder Alerts' }
        ]}
      />
      {tab === 'warehouse' && <WarehouseStock />}
      {tab === 'catalog' && <MasterCatalog />}
      {tab === 'custody' && <CustodyRegister />}
      {tab === 'alerts' && <RopAlertCenter />}
    </>
  );
};
