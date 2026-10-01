'use client';

import { MinusIcon, PlusIcon } from './Icons';

/**
 * Accessible quantity control used on the cart page.
 *
 * The real value lives in a visually hidden <input> so assistive technology
 * sees a number field, while sighted users get the +/- affordance from the
 * design. Clamping happens here and is re-checked by the API.
 */
export interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}

export function QuantityStepper({
  value,
  min = 0,
  max = 99,
  label,
  disabled = false,
  onChange,
}: QuantityStepperProps) {
  const decrease = () => onChange(Math.max(min, value - 1));
  const increase = () => onChange(Math.min(max, value + 1));

  return (
    <div className="qty">
      <button
        type="button"
        className="qty__btn"
        onClick={decrease}
        disabled={disabled || value <= min}
        aria-label={`Reduce quantity of ${label}`}
      >
        <MinusIcon size={16} />
      </button>

      {/* Announced politely to screen readers as the buttons change it. */}
      <span className="qty__value" role="status" aria-live="polite" aria-atomic="true">
        <span className="sr-only">Quantity: </span>
        {value}
      </span>

      <button
        type="button"
        className="qty__btn"
        onClick={increase}
        disabled={disabled || value >= max}
        aria-label={`Increase quantity of ${label}`}
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
}
