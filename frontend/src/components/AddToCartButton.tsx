'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/context/CartProvider';
import { CheckIcon } from './Icons';

/**
 * Adds the product to the server-side cart.
 *
 * The button reflects four states — idle, working, added, failed — because the
 * outcome is decided by the API (stock limits, for example), and a shopper needs
 * to be told when something could not be added rather than left guessing.
 */
export interface AddToCartButtonProps {
  productId: string;
  quantity?: number;
  label?: string;
  className?: string;
  disabled?: boolean;
  disabledLabel?: string;
}

export function AddToCartButton({
  productId,
  quantity = 1,
  label = 'Add to Cart',
  className = 'btn btn--block',
  disabled = false,
  disabledLabel = 'Out of stock',
}: AddToCartButtonProps) {
  const { addItem, mutating } = useCart();
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // Never leave a timer running after the card unmounts.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = async () => {
    setMessage(null);
    const result = await addItem(productId, quantity);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setAdded(true);
    timer.current = window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={disabled || mutating}
        aria-live="polite"
      >
        {added ? (
          <>
            <CheckIcon size={16} /> Added
          </>
        ) : disabled ? (
          disabledLabel
        ) : (
          label
        )}
      </button>

      {message ? (
        <p className="field__error" role="alert" style={{ marginTop: 'var(--space-2)' }}>
          {message}
        </p>
      ) : null}
    </>
  );
}
