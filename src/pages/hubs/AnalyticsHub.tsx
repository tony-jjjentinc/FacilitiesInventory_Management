import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TabBar, useTabParam } from '../../components/TabBar';
import { getCurrentUser, isUserHeadOrAdmin } from '../../services/auth';
import { AnalyticsOverview } from './AnalyticsOverview';
import { CostOfStock, CostPerProject, type PriceDraft } from './CostViews';

const KEYS = ['overview', 'stock', 'projects'];

export const AnalyticsHub: React.FC = () => {
  const [tab, setTab] = useTabParam(KEYS);
  const navigate = useNavigate();
  const isAdmin = isUserHeadOrAdmin(getCurrentUser());
  const setPrice = (d: PriceDraft) => navigate(`/admin?tab=price&scopeType=${encodeURIComponent(d.scopeType)}&scopeRef=${encodeURIComponent(d.scopeRef)}&itemId=${encodeURIComponent(d.itemId)}`);

  return (
    <>
      <TabBar label="Analytics" active={tab} onChange={setTab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'stock', label: 'Cost of Stock' }, { key: 'projects', label: 'Cost per Project' }]} />
      <div className="container py-4 px-3 px-md-4">
        {tab === 'overview' && <AnalyticsOverview />}
        {tab === 'stock' && <CostOfStock isAdmin={isAdmin} onSetPrice={setPrice} />}
        {tab === 'projects' && <CostPerProject isAdmin={isAdmin} onSetPrice={setPrice} />}
      </div>
    </>
  );
};
