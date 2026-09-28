import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { apiRequest } from '../services/api';
import type { WarehouseStockItem } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

interface DashboardOverviewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const [stockItems, setStockItems] = useState<WarehouseStockItem[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await apiRequest<WarehouseStockItem[]>('inventory:getWarehouseStock');
        if (Array.isArray(data)) {
          setStockItems(data);
        }
      } catch (err) {
        console.error('Failed to load stock data:', err);
      }
    };
    loadData();
  }, []);

  const totalValuation = stockItems.reduce((acc, curr) => acc + (Number(curr.Valuation) || 0), 0);
  const criticalItems = stockItems.filter(item => item.ROP_Status === 'CRITICAL_DEPLETION');
  const warningItems = stockItems.filter(item => item.ROP_Status === 'REORDER_WARNING');
  const consumableCount = stockItems.filter(item => item.Classification === 'CNS').length;
  const toolCount = stockItems.filter(item => item.Classification === 'TLS').length;
  const spareCount = stockItems.filter(item => item.Classification === 'SPR').length;

  const doughnutData = {
    labels: ['Consumables (CNS)', 'Tools & Equipment (TLS)', 'Spare Parts (SPR)', 'Misc (MSC)'],
    datasets: [
      {
        data: [
          consumableCount,
          toolCount,
          spareCount,
          stockItems.length - consumableCount - toolCount - spareCount
        ],
        backgroundColor: ['#0f172a', '#475569', '#94a3b8', '#cbd5e1'],
        borderWidth: 1
      }
    ]
  };

  const barData = {
    labels: ['Plumbing', 'Electrical', 'HVAC', 'Civil', 'Hardware', 'Power Tools'],
    datasets: [
      {
        label: 'Stock Valuation (PHP)',
        data: [45000, 38500, 52000, 18000, 24000, 68000],
        backgroundColor: '#334155',
        borderRadius: 2
      }
    ]
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-2 border-bottom">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Executive Overview</h4>
          <p className="text-muted small mb-0">
            Real-time physical asset valuation, stock status, and inventory velocity.
          </p>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => onNavigate('catalog')}>
            Master Catalog
          </button>
          <button className="btn btn-dark btn-sm" onClick={() => onNavigate('alerts')}>
            Stockout Alerts
          </button>
        </div>
      </div>

      {/* Minimal KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border shadow-sm p-3 h-100 bg-white">
            <div className="text-muted small text-uppercase fw-semibold mb-1">Total Valuation</div>
            <h4 className="fw-bold mb-1 text-dark">
              PHP {totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <div className="text-muted small">Across all active facilities</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border shadow-sm p-3 h-100 bg-white">
            <div className="text-muted small text-uppercase fw-semibold mb-1">Critical Stockouts</div>
            <h4 className="fw-bold mb-1 text-danger">
              {criticalItems.length} Items
            </h4>
            <div className="text-muted small">Below safety stock threshold</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border shadow-sm p-3 h-100 bg-white">
            <div className="text-muted small text-uppercase fw-semibold mb-1">Reorder Warnings</div>
            <h4 className="fw-bold mb-1 text-warning">
              {warningItems.length} Items
            </h4>
            <div className="text-muted small">Reached 90-day ROP threshold</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border shadow-sm p-3 h-100 bg-white">
            <div className="text-muted small text-uppercase fw-semibold mb-1">Tracked SKUs</div>
            <h4 className="fw-bold mb-1 text-dark">
              {stockItems.length} SKUs
            </h4>
            <div className="text-muted small">Active fiscal operational ledger</div>
          </div>
        </div>
      </div>

      {/* Minimal Charts */}
      <div className="row g-3">
        <div className="col-12 col-lg-8">
          <div className="card border shadow-sm h-100 bg-white">
            <div className="card-header bg-white py-3 border-bottom">
              <span className="fw-semibold small text-uppercase text-muted">Valuation by Trade Scope</span>
            </div>
            <div className="card-body">
              <div style={{ height: '280px' }}>
                <Bar
                  data={barData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: { grid: { color: '#f1f5f9' } }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card border shadow-sm h-100 bg-white">
            <div className="card-header bg-white py-3 border-bottom">
              <span className="fw-semibold small text-uppercase text-muted">Inventory Classification</span>
            </div>
            <div className="card-body d-flex align-items-center justify-content-center">
              <div style={{ width: '220px', height: '220px' }}>
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
