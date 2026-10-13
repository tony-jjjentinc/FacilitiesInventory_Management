/**
 * @file StorageByOwner.tsx
 * @description The areas of a warehouse grouped by the sub-department that owns them (plus the common areas), so it is clear
 * who has which space and which sub-departments have none yet.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { EntityStorageNode } from '../../types';
import { entityPath, peso } from './entityPaths';

interface Props {
  areas: EntityStorageNode[];
  subDepartments: string[];
  showCosts: boolean;
  admin: boolean;
  onEdit: (n: EntityStorageNode) => void;
}

export const StorageByOwner: React.FC<Props> = ({ areas, subDepartments, showCosts, admin, onEdit }) => {
  const owners = Array.from(new Set([...subDepartments, ...areas.map(a => a.ownerSubDepartment).filter(Boolean)])).sort((a, b) => a.localeCompare(b));
  const groups = [...owners.map(o => ({ name: o, common: false, rows: areas.filter(a => a.ownerSubDepartment.toLowerCase() === o.toLowerCase()) })),
    { name: 'Common areas', common: true, rows: areas.filter(a => !a.ownerSubDepartment) }];
  return (
    <div className="row g-3 p-3">
      {groups.map(g => {
        const items = g.rows.reduce((s, r) => s + r.items, 0);
        const value = g.rows.reduce((s, r) => s + r.stockValue, 0);
        return (
          <div key={g.name} className="col-12 col-xl-6">
            <div className="card border h-100 bg-white">
              <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div className="fw-semibold">{g.common ? g.name : <Link to={entityPath('SUBDEPARTMENT', g.name)} className="text-decoration-none">{g.name}</Link>}</div>
                <div className="small text-muted">{g.rows.length} area{g.rows.length === 1 ? '' : 's'} · {items} item{items === 1 ? '' : 's'}{showCosts && <> · {peso(value)}</>}</div>
              </div>
              {g.rows.length === 0 ? <div className="text-muted small p-3">{g.common ? 'No common areas.' : 'No areas assigned yet.'}</div> : (
                <ul className="list-group list-group-flush">
                  {g.rows.map(a => (
                    <li key={a.storageId} className="list-group-item d-flex justify-content-between align-items-center gap-2">
                      <div className="min-w-0">
                        <Link to={entityPath('AREA', a.storageId)} className="fw-semibold text-decoration-none">{a.name || a.storageId}</Link>
                        {a.status === 'INACTIVE' && <span className="badge text-bg-warning ms-2">Inactive</span>}
                        <div className="small text-muted">{a.items} item{a.items === 1 ? '' : 's'}{showCosts && <> · {peso(a.stockValue)}</>}</div>
                      </div>
                      {admin && <button type="button" className="btn btn-secondary btn-sm py-0" onClick={() => onEdit(a)}>Change owner</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
