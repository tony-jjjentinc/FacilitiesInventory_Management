/**
 * @file ConfigTab.tsx
 * @description The configuration record behind an entity page, read only for everyone. Admins (Head, Super Admin)
 * also get a button that opens the same table in Configuration to edit it.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { isUserHeadOrAdmin, getCurrentUser } from '../../services/auth';
import type { EntityProfile } from '../../types';
import { ENTITY_CONFIG } from './entityPaths';

interface Props { profile: EntityProfile }

export const ConfigTab: React.FC<Props> = ({ profile }) => {
  const cfg = ENTITY_CONFIG[profile.scopeType];
  const admin = isUserHeadOrAdmin(getCurrentUser());
  const fields = Object.entries(profile.record || {});
  return (
    <div className="card border shadow-sm bg-white">
      <div className="card-header bg-white d-flex align-items-center justify-content-between gap-2 py-3 px-3 px-md-4">
        <div>
          <h5 className="fw-bold mb-0">Configurations</h5>
          <div className="small text-muted">{cfg ? `${cfg.label} record in the ${cfg.table.replace(/_/g, ' ')} table` : 'Settings of this record'}</div>
        </div>
        {admin && cfg && <Link to={`/configuration?table=${cfg.slug}`} className="btn btn-primary btn-sm">Edit in Configuration</Link>}
      </div>
      <dl className="row g-0 mb-0">
        {fields.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="col-sm-4 col-md-3 px-3 px-md-4 py-2 border-bottom small text-muted fw-normal">{k.replace(/_/g, ' ')}</dt>
            <dd className="col-sm-8 col-md-9 px-3 py-2 border-bottom mb-0 small text-dark" style={{ overflowWrap: 'anywhere' }}>{String(v ?? '').trim() || 'No Data'}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
};
