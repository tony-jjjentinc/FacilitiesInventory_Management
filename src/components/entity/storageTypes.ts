/** The storage types, what each may sit in (mirrors STORAGE_PARENTS in api/ReceivingService.gs; the API enforces it) and how they look. */
import type { EntityStorageNode } from '../../types';

export type NodeType = EntityStorageNode['storageType'];
export const PARENTS: Record<NodeType, NodeType[]> = { AREA: [], SHELF: ['AREA'], LEVEL: ['SHELF'], CONTAINER: ['AREA', 'SHELF', 'LEVEL'], SPACE: ['AREA'] };
export const TYPE_LABEL: Record<NodeType, string> = { AREA: 'Area', SHELF: 'Shelf', LEVEL: 'Level', CONTAINER: 'Container', SPACE: 'Space' };
export const TYPE_ICON: Record<NodeType, string> = { AREA: 'bi-grid-3x3-gap', SHELF: 'bi-bookshelf', LEVEL: 'bi-layers', CONTAINER: 'bi-box-seam', SPACE: 'bi-bounding-box' };
export const CHILD_TYPES: NodeType[] = ['SHELF', 'LEVEL', 'CONTAINER', 'SPACE'];

/** The types that may be added inside a node of this type. */
export const childTypesOf = (t: NodeType): NodeType[] => CHILD_TYPES.filter(c => PARENTS[c].includes(t));

export const capacityText = (n: { capacity?: number | null; capacityUnit?: string }) =>
  n.capacity === null || n.capacity === undefined ? '' : `${n.capacity.toLocaleString()}${n.capacityUnit ? ` ${n.capacityUnit}` : ''}`;
