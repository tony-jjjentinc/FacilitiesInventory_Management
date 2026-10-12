/**
 * @file TimelineTab.tsx
 * @description Timeline / history of an entity: ledger movements and configuration changes, newest first.
 * Shows the current fiscal year; the year selector opens an archived year. 50 events per page.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Loading } from '../Loading';
import { RefreshButton } from '../RefreshButton';
import type { EntityScopeType, EntityTimeline, EntityTimelineEvent } from '../../types';
import { peso, qty } from './entityPaths';
import { getCurrentUser } from '../../services/auth';
import { getAccess } from '../../services/access';

const TYPE_LABEL: Record<string, string> = {
  'IN:MRL': 'Received (MRL)', 'IN:MANUAL': 'Received (manual)', 'IN:PETTY_CASH': 'Received (petty cash)', 'IN:RF': 'Received (RF)', 'IN:RFP': 'Received (RFP)',
  'IN:EXCESS': 'Surplus returned', 'IN:RETRIEVE': 'Tool returned', 'OUT:RELEASE': 'Issued to activity', 'OUT:DEPLOY': 'Tool assigned', 'OUT:DISPOSAL': 'Written off',
  'TRANSFER:INVENTORY': 'Transferred', 'TRANSFER:IN_HOUSE': 'Custody transferred', CREATE: 'Created', UPDATE: 'Changed', DELETE: 'Archived'
};
const label = (t: string) => TYPE_LABEL[t] || t;

interface Props { scopeType: EntityScopeType; scopeRef: string }

export const TimelineTab: React.FC<Props> = ({ scopeType, scopeRef }) => {
  const access = getAccess(getCurrentUser());
  const [year, setYear] = useState<number | null>(null);
  const [events, setEvents] = useState<EntityTimelineEvent[]>([]);
  const [meta, setMeta] = useState<{ total: number; next: number | null; years: number[] }>({ total: 0, next: null, years: [] });
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (cursor: number, y: number | null) => {
    const res = await apiRequest<EntityTimeline>('entity:getTimeline', { scopeType, scopeRef, cursor, ...(y ? { year: y } : {}) });
    setEvents(prev => (cursor === 0 ? res.events : [...prev, ...res.events]));
    setMeta({ total: res.total, next: res.nextCursor, years: res.years });
  }, [scopeType, scopeRef]);

  const first = useCallback((y: number | null) => {
    setLoading(true); setError('');
    load(0, y).catch(e => setError(e.message || 'Failed to load the timeline.')).finally(() => setLoading(false));
  }, [load]);

  useEffect(() => { first(year); }, [first, year]);

  return (
    <div className="card border shadow-sm bg-white">
      <div className="card-header bg-white d-flex flex-wrap align-items-center justify-content-between gap-2 py-3 px-3 px-md-4">
        <div>
          <h5 className="fw-bold mb-0">Timeline</h5>
          <div className="small text-muted">{meta.total} event(s){year ? ` in ${year}` : ' this fiscal year'}</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {meta.years.length > 1 && (
            <select className="form-select form-select-sm" style={{ width: '150px' }} aria-label="Fiscal year" value={year ?? ''} onChange={e => setYear(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Current year</option>
              {meta.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <RefreshButton onClick={() => first(year)} loading={loading && events.length > 0} />
        </div>
      </div>
      {error && <div className="alert alert-danger small m-3">{error}</div>}
      {loading && events.length === 0 && <Loading label="Loading the timeline…" />}
      {!loading && !error && events.length === 0 && <div className="text-center text-muted small py-5">No events yet.</div>}
      <ul className="list-group list-group-flush">
        {events.map(e => (
          <li key={`${e.kind}-${e.ref}-${e.at}`} className="list-group-item px-3 px-md-4 py-3">
            <div className="d-flex flex-wrap justify-content-between gap-2">
              <div>
                <span className="fw-semibold text-dark">{e.kind === 'CONFIG' ? `${label(e.type)} · ${e.title.split(' ').slice(1).join(' ')}` : label(e.type)}</span>
                {e.status && e.status !== 'POSTED' && <span className="badge text-bg-warning ms-2">{e.status}</span>}
                {e.kind === 'CONFIG' && <span className="badge text-bg-light border fw-normal ms-2">Setting</span>}
              </div>
              <div className="small text-muted">{e.at}</div>
            </div>
            {e.detail && <div className="small text-secondary">{e.detail}</div>}
            <div className="small text-muted">
              {e.who || 'No Data'}
              {e.kind === 'LEDGER' && <> · {qty(e.qty || 0)} unit(s) · {access.canSeeCosts && <>{peso(e.value || 0)} · </>}{e.ref}</>}
              {e.from && e.to && <> · {e.from} → {e.to}</>}
            </div>
          </li>
        ))}
      </ul>
      {meta.next !== null && (
        <div className="p-3 text-center border-top">
          <button type="button" className="btn btn-secondary btn-sm" disabled={more}
            onClick={() => { setMore(true); load(meta.next as number, year).catch(e => setError(e.message)).finally(() => setMore(false)); }}>
            {more ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};
