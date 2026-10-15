/** Colours shared by every chart. */
export const PALETTE = ['#184421', '#2f6f3e', '#5c9a6a', '#93bf9d', '#c5ddca', '#64748b', '#94a3b8', '#cbd5e1'];

/** The usual pairs: what came in / what went out (received, issued), and the light grid lines of the analytics charts. */
export const COLOR = { in: '#2f6f3e', out: '#94a3b8', strong: '#184421', soft: '#5c9a6a', grid: '#f1f5f9' } as const;
export const HEALTH = ['#198754', '#f59f00', '#dc3545']; // normal, reorder warning, critical

/** Many series on one chart (a bar per sub-department, system, ...): more hues than PALETTE, so neighbours stay apart. */
export const SERIES = ['#184421', '#2f6f3e', '#5c9a6a', '#93bf9d', '#64748b', '#94a3b8', '#b45309', '#cbd5e1'];
export const OTHERS = '#e2e8f0';
