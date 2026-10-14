/**
 * @file EntityPage.tsx
 * @description Shared shell of every entity page: breadcrumb to the parent, title, badges, key figures and tabs.
 *
 *   <EntityPage scopeType="AREA" scopeRef={id} tabs={[
 *     { key: 'overview', label: 'Overview', render: p => <EntityOverviewTab scopeType="AREA" scopeRef={id} /> },
 *     { key: 'stock',    label: 'Inventory Stock', render: () => <StockTab ... /> }
 *   ]} />
 *
 * - The first tab is the default; the active tab lives in the URL (`?tab=`), like the other pages.
 * - Only the open tab is mounted, so each tab loads its data when first opened.
 * - The key figures sit at the top of the Overview tab only.
 * - Loading, "not found" and "no access" are handled here; tabs only render once the profile loaded.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { TabBar, useTabParam } from '../TabBar';
import { Loading } from '../Loading';
import type { EntityFigure, EntityProfile, EntityScopeType } from '../../types';
import { ENTITY_LABEL, entityPath, peso, qty } from './entityPaths';
import { entityErrorText, useEntityData } from './useEntity';
import { fmtDate } from '../../utils/datetime';

export interface EntityTab {
  key: string;
  label: string;
  render: (profile: EntityProfile, openTab: (key: string) => void, reload: () => void) => React.ReactNode;
}

interface Props {
  scopeType: EntityScopeType;
  scopeRef: string;
  tabs: EntityTab[];
  /** where the "back" link in the not-found state goes, e.g. the Warehouses list */
  backTo?: { path: string; label: string };
}

const show = (f: EntityFigure) => (f.kind === 'money' ? peso(Number(f.value)) : f.kind === 'qty' ? qty(Number(f.value)) : /^\d{4}-\d{2}-\d{2}/.test(String(f.value)) ? fmtDate(f.value) : String(f.value)); // the API sends dates as text

export const EntityPage: React.FC<Props> = ({ scopeType, scopeRef, tabs, backTo }) => {
  const { data: profile, loading, error, reload } = useEntityData<EntityProfile>('getProfile', scopeType, scopeRef);
  const [tab, setTab] = useTabParam(tabs.map(t => t.key));
  const active = tabs.find(t => t.key === tab) || tabs[0];

  if (loading && !profile) return <div className="container py-5"><Loading label="Loading…" /></div>;
  if (error && !profile) {
    const e = entityErrorText(error, ENTITY_LABEL[scopeType]);
    return (
      <div className="container py-5 text-center">
        <h5 className="fw-bold">{e.title}</h5>
        <p className="text-muted">{e.text}</p>
        {backTo && <Link to={backTo.path} className="btn btn-primary btn-sm">{backTo.label}</Link>}
      </div>
    );
  }
  if (!profile) return null;

  return (
    <>
      <div className="container pt-4 px-3 px-md-4">
        {(profile.parents.length > 0 || backTo) && (
          <nav className="small mb-1" aria-label="Breadcrumb">
            {profile.parents.map(p => <Link key={p.type + p.id} to={entityPath(p.type, p.id)} className="text-decoration-none me-2">{p.label} <span className="text-muted">/</span></Link>)}
            {!profile.parents.length && backTo && <Link to={backTo.path} className="text-decoration-none">{backTo.label}</Link>}
          </nav>
        )}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <h4 className="fw-bold mb-0">{profile.title}</h4>
          {profile.badges.map(b => <span key={b} className="badge text-bg-light border fw-normal">{b}</span>)}
        </div>
        <div className="small text-muted mb-2">{profile.subtitle}</div>
      </div>
      <TabBar label={profile.title} active={active.key} onChange={setTab} tabs={tabs.map(t => ({ key: t.key, label: t.label }))} />
      <div className="container pb-4 px-3 px-md-4 pt-3" key={active.key}>
        {active.key === 'overview' && (
        <div className="row g-2 mb-3">
          {profile.figures.map(f => (
            <div key={f.label} className="col-6 col-lg-3">
              <div className="card border shadow-sm h-100 bg-white p-3">
                <div className="small text-muted text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>{f.label}</div>
                <div className="fw-bold fs-5 text-dark text-truncate">{show(f)}</div>
              </div>
            </div>
          ))}
        </div>
        )}
        {active.render(profile, setTab, reload)}
      </div>
    </>
  );
};
