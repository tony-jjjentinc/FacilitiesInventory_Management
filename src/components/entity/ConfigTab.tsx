/**
 * @file ConfigTab.tsx
 * @description The configuration record behind an entity page, read only for everyone. Admins (Head, Super Admin)
 * also get a button that opens the same table in Configuration to edit it.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { isUserHeadOrAdmin, getCurrentUser } from '../../services/auth';
import type { EntityProfile } from '../../types';
import { ENTITY_CONFIG } from './entityPaths';

interface Props {
  profile: EntityProfile;
  /** edit here instead of sending admins to Configuration */
  onEdit?: () => void;
  /** more admin buttons next to Edit */
  extra?: React.ReactNode;
}

export const ConfigTab: React.FC<Props> = ({ profile, onEdit, extra }) => {
  const cfg = ENTITY_CONFIG[profile.scopeType];
  const admin = isUserHeadOrAdmin(getCurrentUser());
  const [showEmpty, setShowEmpty] = useState(false);
  const all = Object.entries(profile.record || {});
  const filled = all.filter(([, v]) => String(v ?? '').trim() !== '');
  const empty = all.filter(([, v]) => String(v ?? '').trim() === '');
  const fields = showEmpty ? all : filled;
  return (
    <div className="card border shadow-sm bg-white">
      <div className="card-header bg-white d-flex align-items-center justify-content-between gap-2 py-3 px-3 px-md-4">
        <div>
          <h5 className="fw-bold mb-0">Configurations</h5>
          <div className="small text-muted">{cfg ? `${cfg.label} record in the ${cfg.table.replace(/_/g, ' ')} table` : 'Settings of this record'}</div>
        </div>
        {admin && cfg && (
          <div className="d-flex gap-2">
            {extra}
            {onEdit ? <button type="button" className="btn btn-primary btn-sm" onClick={onEdit}>Edit</button> : <Link to={`/configuration?table=${cfg.slug}`} className="btn btn-primary btn-sm">Edit in Configuration</Link>}
          </div>
        )}
      </div>
      <dl className="row g-0 mb-0 px-3 px-md-4 py-2">
        {fields.map(([k, v]) => {
          const text = String(v ?? '').trim();
          return (
            <div key={k} className="col-12 col-md-6 py-2 pe-md-3">
              <dt className="small text-muted fw-normal">{k.replace(/_/g, ' ')}</dt>
              <dd className={`mb-0 ${text ? 'text-dark' : 'text-muted'}`} style={{ overflowWrap: 'anywhere' }}>{text || '–'}</dd>
            </div>
          );
        })}
      </dl>
      {empty.length > 0 && (
        <div className="border-top px-3 px-md-4 py-2">
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setShowEmpty(v => !v)}>{showEmpty ? 'Hide empty fields' : `Show ${empty.length} empty field${empty.length === 1 ? '' : 's'}`}</button>
        </div>
      )}
    </div>
  );
};
