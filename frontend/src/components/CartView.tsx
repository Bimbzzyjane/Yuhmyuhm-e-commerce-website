'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/context/CartProvider';
import { BagIcon, TrashIcon } from './Icons';
import { ProductImage } from './ProductImage';
import { QuantityStepper } from './QuantityStepper';

/**
 * The cart page body.
 *
 * Every mutation returns the whole cart, so this view never recalculates a
 * total itself — it renders `cart.subtotalLabel`, `cart.deliveryFeeLabel` and
 * `cart.totalLabel` exactly as the API produced them. That is what guarantees
 * the amount shown here is the amount the order will be created for.
 */
export function CartView() {
  const { cart, loading, mutating, error, updateItem, removeItem, clear } = useCart();
  const [notice, setNotice] = useState<string | null>(null);

  const handleQuantity = async (itemId: string, quantity: number) => {
    setNotice(null);
    const result = await updateItem(itemId, quantity);
    if (!result.ok) setNotice(result.message);
  };

  const handleRemove = async (itemId: string) => {
    setNotice(null);
    const result = await removeItem(itemId);
    if (!result.ok) setNotice(result.message);
  };

  const handleClear = async () => {
    setNotice(null);
    const result = await clear();
    if (!result.ok) setNotice(result.message);
  };

  if (loading) {
    return (
      <div className="loading-block">
        <span className="spinner" aria-hidden="true" />
        Loading your cart…
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="empty">
        <span className="empty__icon" aria-hidden="true">
          <BagIcon size={28} />
        </span>
        <h2 className="empty__title">Your cart is empty</h2>
        <p className="empty__body">
          Browse our cakes and catering equipment — anything you add is saved to your cart, even if
          you come back later.
        </p>
        <div className="section-actions">
          <Link href="/category/cakes" className="btn">
            Shop cakes
          </Link>
          <Link href="/search" className="btn btn--outline">
            Browse everything
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {error || notice ? (
        <div className="alert alert--error" role="alert">
          <div>
            <span className="alert__title">We could not update your cart</span>
            {notice ?? error}
          </div>
        </div>
      ) : null}

      <div className="split">
        <div>
          <ul>
            {cart.items.map((line) => (
              <li className="cart-line" key={line.id}>
                <div className="cart-line__media">
                  <ProductImage
                    src={line.product.imageUrl}
                    alt={line.product.name}
                    className="cart-line__image"
                    sizes="96px"
                  />
                </div>

                <div className="cart-line__info">
                  <Link href={`/products/${line.product.slug}`} className="cart-line__name">
                    {line.product.name}
                  </Link>
                  <span className="cart-line__unit">{line.unitPriceLabel} each</span>
                  {line.exceedsStock ? (
                    <span className="field__error" role="alert">
                      Only {line.product.stockQuantity} left — please reduce the quantity.
                    </span>
                  ) : null}
                </div>

                <div className="cart-line__controls">
                  <QuantityStepper
                    value={line.quantity}
                    min={0}
                    max={Math.min(line.product.stockQuantity, 20)}
                    label={line.product.name}
                    disabled={mutating}
                    onChange={(next) => void handleQuantity(line.id, next)}
                  />
                  <span className="cart-line__total">{line.lineTotalLabel}</span>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => void handleRemove(line.id)}
                    disabled={mutating}
                  >
                    <TrashIcon size={15} /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="cart-actions">
            <Link href="/search" className="btn btn--ghost">
              Continue shopping
            </Link>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void handleClear()}
              disabled={mutating}
            >
              Empty cart
            </button>
          </div>
        </div>

        <aside className="summary" aria-label="Order summary">
          <h2 className="summary__title">Order summary</h2>

          <dl>
            <div className="summary__row">
              <dt>Subtotal ({cart.itemCount} items)</dt>
              <dd>{cart.subtotalLabel}</dd>
            </div>
            <div
              className={
                cart.qualifiesForFreeDelivery ? 'summary__row summary__row--free' : 'summary__row'
              }
            >
              <dt>Delivery</dt>
              <dd>{cart.qualifiesForFreeDelivery ? 'Free' : cart.deliveryFeeLabel}</dd>
            </div>
            <div className="summary__row summary__row--total">
              <dt>Total</dt>
              <dd>{cart.totalLabel}</dd>
            </div>
          </dl>

          <p className="summary__note">
            Delivery is free on orders over ₦150,000. We will confirm your delivery window after
            checkout.
          </p>

          <div className="summary__cta">
            <Link href="/checkout" className="btn btn--block">
              Proceed to checkout
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
