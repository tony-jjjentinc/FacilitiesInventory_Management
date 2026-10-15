/** The one place numbers become text: pesos and quantities, as the whole app writes them. */
const TWO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/** ₱1,234.50 */
export const peso = (n: unknown) => `₱${(Number(n) || 0).toLocaleString(undefined, TWO)}`;
/** ₱1,235 (chart tooltips of large totals) */
export const pesoWhole = (n: unknown) => `₱${Math.round(Number(n) || 0).toLocaleString()}`;
/** ₱12k (chart axis ticks) */
export const pesoK = (n: unknown) => `₱${((Number(n) || 0) / 1000).toFixed(0)}k`;
/** 1,234.5 (up to three decimals) */
export const qty = (n: unknown) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
