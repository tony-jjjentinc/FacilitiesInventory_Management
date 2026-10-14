import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { TabBar, useTabParam } from '../../components/TabBar';
import { WarehouseStock } from '../WarehouseStock';
import { MasterCatalog } from '../MasterCatalog';
import { CustodyRegister } from '../CustodyRegister';
import { RopAlertCenter } from '../RopAlertCenter';
import { WarehousesIndex } from '../entity/WarehousesIndex';

const KEYS = ['warehouse', 'catalog', 'custody', 'alerts', 'warehouses'];
/** Receiving moved to Deliveries: old links (/inventory?tab=pending ...) keep working. */
const MOVED: Record<string, string> = { assign: 'assign', assignments: 'tasks', pending: 'tasks', returns: 'returns', 'receive-manual': 'receive-manual', 'receive-mrl': 'receive-mrl' };

export const InventoryStockHub: React.FC = () => {
  const [tab, setTab] = useTabParam(KEYS);
  const [params] = useSearchParams();
  const moved = MOVED[params.get('tab') || ''];
  if (moved) { const next = new URLSearchParams(params); next.set('tab', moved); return <Navigate to={`/deliveries?${next.toString()}`} replace />; }
  return (
    <>
      <TabBar
        label="Inventory" active={tab} onChange={setTab}
        tabs={[
          { key: 'warehouse', label: 'Warehouse Stock' },
          { key: 'catalog', label: 'Inventory Catalog' },
          { key: 'custody', label: 'Tool Custody' },
          { key: 'alerts', label: 'Reorder Alerts' },
          { key: 'warehouses', label: 'Warehouses' }
        ]}
      />
      {tab === 'warehouse' && <WarehouseStock />}
      {tab === 'catalog' && <MasterCatalog />}
      {tab === 'custody' && <CustodyRegister />}
      {tab === 'alerts' && <RopAlertCenter />}
      {tab === 'warehouses' && <WarehousesIndex />}
    </>
  );
};
