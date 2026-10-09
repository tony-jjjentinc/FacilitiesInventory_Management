import React from 'react';
import type { LinePriceSource, ReceivingLine } from '../../types';

const SOURCE: Record<LinePriceSource, string> = {
  SUPPLIER: 'Supplier price',
  BASE: 'Base price',
  NEW_BASE: 'Saves as the base price for this item',
  CUSTOM: 'Custom price for this receipt only',
  NONE: 'No price yet'
};

/** Read-only unit cost. An unpriced item says so in the cell itself; the price source shows on hover. */
export const PriceCell: React.FC<{ line: ReceivingLine }> = ({ line }) => {
  const cost = line.unitCost.trim() === '' ? 0 : Number(line.unitCost);
  if (cost === 0) return <span className="text-warning-emphasis" title="Received at ₱0 until a price is set">To be priced</span>;
  return (
    <span title={SOURCE[line.priceSource]}>
      ₱{cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
};
