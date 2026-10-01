'use client';

import { useState } from 'react';
import { AddToCartButton } from './AddToCartButton';
import { QuantityStepper } from './QuantityStepper';

/**
 * The buy box on the product page.
 *
 * Isolated as its own client component so the rest of the product page stays a
 * server component (image, description and structured data are all rendered
 * into the HTML).
 */
export interface ProductPurchasePanelProps {
  productId: string;
  productName: string;
  /** Upper bound enforced by the stepper; the API re-checks it regardless. */
  maxQuantity: number;
  outOfStock: boolean;
}

export function ProductPurchasePanel({
  productId,
  productName,
  maxQuantity,
  outOfStock,
}: ProductPurchasePanelProps) {
  const [quantity, setQuantity] = useState(1);
  const ceiling = Math.max(1, maxQuantity);

  return (
    <div className="product-detail__actions">
      <QuantityStepper
        value={quantity}
        min={1}
        max={ceiling}
        label={productName}
        disabled={outOfStock}
        onChange={setQuantity}
      />
      <AddToCartButton
        productId={productId}
        quantity={quantity}
        className="btn"
        disabled={outOfStock}
        label="Add to Cart"
      />
    </div>
  );
}
