/**
 * @file StorageTree.tsx
 * @description The inside of an area as a collapsible tree (area > shelf > level > container), the way it looks in the
 * physical warehouse. Admins can edit, deactivate and add inside a node.
 */
import React, { useMemo, useState } from 'react';
import type { EntityStorageNode } from '../../types';
import { TYPE_ICON, TYPE_LABEL, capacityText, childTypesOf } from './storageTypes';

interface Props {
  nodes: EntityStorageNode[];
  rootId: string;
  rootName: string;
  admin: boolean;
  onEdit: (n: EntityStorageNode) => void;
  onRetire: (n: EntityStorageNode) => void;
  /** open the add form with this parent preselected */
  onAdd: (parentId: string) => void;
  /** open the list of items on this spot ('' = the units not on any spot) */
  onViewItems?: (spotId: string, title: string) => void;
  /** units of the area not on any spot; undefined when the workbook does not track spots */
  unassigned?: { qty: number; lines: number };
}

const label = (n: EntityStorageNode) => n.name || (n.shelfNumber ? `Shelf ${n.shelfNumber}` : n.storageId);
const order = (a: EntityStorageNode, b: EntityStorageNode) => (a.shelfNumber || a.level || a.name).localeCompare(b.shelfNumber || b.level || b.name, undefined, { numeric: true });

export const StorageTree: React.FC<Props> = ({ nodes, rootId, rootName, admin, onEdit, onRetire, onAdd, onViewItems, unassigned }) => {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const kids = useMemo(() => {
    const m = new Map<string, EntityStorageNode[]>();
    nodes.forEach(n => m.set(n.parentStorageId, [...(m.get(n.parentStorageId) || []), n]));
    m.forEach(list => list.sort(order));
    return m;
  }, [nodes]);
  const toggle = (id: string) => setClosed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const row = (n: EntityStorageNode, depth: number): React.ReactNode => {
    const children = kids.get(n.storageId) || [];
    const open = !closed.has(n.storageId);
    const cap = capacityText(n);
    const inactive = n.status === 'INACTIVE';
    return (
      <li key={n.storageId} className="list-unstyled">
        <div className={`storage-tree-row d-flex align-items-center gap-2 py-1 pe-2 border-bottom${inactive ? ' text-muted' : ''}`} style={{ paddingLeft: `${depth * 22 + 8}px` }}>
          {children.length > 0
            ? <button type="button" className="btn btn-link btn-sm p-0 text-muted" style={{ width: '1.1rem' }} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${label(n)}`} onClick={() => toggle(n.storageId)}><i className={`bi ${open ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i></button>
            : <span style={{ width: '1.1rem' }}></span>}
          <i className={`bi ${TYPE_ICON[n.storageType]} text-muted`}></i>
          <div className="flex-grow-1 min-w-0">
            <span className={`fw-semibold ${inactive ? '' : 'text-dark'}`}>{label(n)}</span>
            <span className="badge bg-light text-muted border fw-normal ms-2">{TYPE_LABEL[n.storageType]}</span>
            {cap && <span className="small text-muted ms-2">Capacity {cap}</span>}
            {onViewItems && n.totalQty > 0 && (
              <button type="button" className="btn btn-link btn-sm p-0 ms-2 align-baseline" onClick={() => onViewItems(n.storageId, label(n))}>
                {n.totalQty.toLocaleString()} unit{n.totalQty === 1 ? '' : 's'} · {n.spotItems} item{n.spotItems === 1 ? '' : 's'}
              </button>
            )}
            {inactive && <span className="badge text-bg-warning ms-2">Inactive</span>}
            {n.description && <div className="small text-muted text-truncate">{n.description}</div>}
          </div>
          {admin && (
            <div className="d-flex gap-1 flex-shrink-0">
              {!inactive && childTypesOf(n.storageType).length > 0 && <button type="button" className="btn btn-secondary btn-sm py-0" onClick={() => onAdd(n.storageId)}>Add inside</button>}
              <button type="button" className="btn btn-secondary btn-sm py-0" onClick={() => onEdit(n)}>Edit</button>
              {!inactive && <button type="button" className="btn btn-secondary btn-sm py-0" onClick={() => onRetire(n)}>Deactivate</button>}
            </div>
          )}
        </div>
        {open && children.length > 0 && <ul className="p-0 m-0">{children.map(c => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  const top = kids.get(rootId) || [];
  return (
    <div className="p-2">
      <div className="d-flex align-items-center gap-2 py-1 px-2 border-bottom">
        <i className={`bi ${TYPE_ICON.AREA}`}></i><span className="fw-semibold text-dark">{rootName}</span><span className="badge bg-light text-muted border fw-normal">Area</span>
        {onViewItems && unassigned && unassigned.qty > 0 && (
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => onViewItems('', 'Whole area (not on a spot yet)')}>
            {unassigned.qty.toLocaleString()} unit{unassigned.qty === 1 ? '' : 's'} not on a spot
          </button>
        )}
        {admin && <button type="button" className="btn btn-secondary btn-sm py-0 ms-auto" onClick={() => onAdd(rootId)}>Add inside</button>}
      </div>
      {top.length === 0
        ? <div className="text-muted small p-3">Nothing here yet. Use Add rack to create shelves and levels in one go.</div>
        : <ul className="p-0 m-0">{top.map(n => row(n, 1))}</ul>}
    </div>
  );
};
