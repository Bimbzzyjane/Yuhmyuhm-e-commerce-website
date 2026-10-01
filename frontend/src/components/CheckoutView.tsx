'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { ApiError, api, fieldErrorsFrom, getGuestCartId } from '@/lib/api';
import type { Order } from '@/lib/types';
import { CheckIcon, LockIcon } from './Icons';
import { OrderSummaryPanel } from './OrderSummaryPanel';

/**
 * Checkout.
 *
 * Important: this form collects CONTACT AND DELIVERY DETAILS ONLY. No price is
 * ever submitted — the API re-reads every product and recomputes the totals, so
 * nothing here can influence what is charged.
 *
 * On success the confirmation is rendered in place rather than redirecting to
 * an order page, because a guest has no session and therefore no access to
 * `GET /api/orders/:id`.
 */

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: 'Lagos',
  notes: '',
};

export function CheckoutView() {
  const { accessToken, user } = useAuth();
  const { cart, loading, refresh } = useCart();

  const [draft, setDraft] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Order | null>(null);

  /*
   * Prefill is DERIVED rather than synced in an effect.
   *
   * The Google profile arrives asynchronously, so copying it into state from an
   * effect would cause a second render pass. Instead the displayed form falls
   * back to the profile until the shopper edits anything, at which point their
   * draft takes over completely (and is never overwritten by a late profile).
   */
  const form: FormState = {
    name: draft?.name ?? user?.fullName ?? '',
    email: draft?.email ?? user?.email ?? '',
    phone: draft?.phone ?? user?.phone ?? '',
    address: draft?.address ?? '',
    city: draft?.city ?? EMPTY_FORM.city,
    notes: draft?.notes ?? '',
  };

  const update = (field: keyof FormState) => (value: string) => {
    setDraft((current) => ({ ...form, ...current, [field]: value }));
    setErrors((current) => {
      if (!current[`customer.${field}`]) return current;
      const next = { ...current };
      delete next[`customer.${field}`];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setErrors({});

    try {
      const { data } = await api.placeOrder(
        {
          customer: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            address: form.address,
            city: form.city,
            ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          },
        },
        accessToken ? { accessToken } : { guestCartId: getGuestCartId() },
      );

      setPlaced(data);
      // The API consumed the cart; pulling it again clears the header badge.
      await refresh();
    } catch (caught) {
      const fieldProblems = fieldErrorsFrom(caught);
      if (Object.keys(fieldProblems).length > 0) {
        setErrors(fieldProblems);
      } else {
        setSubmitError(
          caught instanceof ApiError ? caught.message : 'We could not place your order.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------- Success
  if (placed) {
    return (
      <div className="stack--lg">
        <div className="alert alert--success" role="status">
          <CheckIcon size={20} />
          <div>
            <span className="alert__title">Thank you — your order is confirmed.</span>A confirmation
            has been emailed to <strong>{placed.email}</strong>. Our team will call {placed.phone}{' '}
            to arrange delivery and payment.
          </div>
        </div>

        <div className="split">
          <div className="order-card">
            <div className="order-card__head">
              <div>
                <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>
                  Order reference
                </p>
                <p className="order-card__number">{placed.orderNumber}</p>
              </div>
              <span className={`status status--${placed.status}`}>
                {placed.status === 'pending' ? 'Order received' : placed.status}
              </span>
            </div>

            <div className="order-card__lines">
              {placed.items.map((item) => (
                <div className="order-card__line" key={item.id}>
                  <span>
                    {item.productName} × {item.quantity}
                  </span>
                  <span className="nowrap">{item.lineTotalLabel}</span>
                </div>
              ))}
            </div>

            <div className="order-card__foot">
              <div>
                <p className="muted">Delivering to</p>
                <p>
                  {placed.customerName}
                  <br />
                  {placed.deliveryAddress}
                  <br />
                  {placed.deliveryCity}
                </p>
                {placed.deliveryNotes ? (
                  <p className="muted">Note: {placed.deliveryNotes}</p>
                ) : null}
              </div>
              <span className="order-card__total">{placed.totalLabel}</span>
            </div>
          </div>

          <OrderSummaryPanel
            title="What you paid"
            lines={placed.items.map((item) => ({
              key: item.id,
              name: item.productName,
              quantity: item.quantity,
              lineTotalLabel: item.lineTotalLabel,
            }))}
            itemCount={placed.itemCount}
            subtotalLabel={placed.subtotalLabel}
            deliveryFeeLabel={placed.deliveryFeeLabel}
            totalLabel={placed.totalLabel}
            deliveryIsFree={placed.deliveryFee === 0}
            note="No payment has been taken online. We will confirm the total with you before delivery."
          />
        </div>

        <div className="section-actions">
          <Link href="/search" className="btn">
            Continue shopping
          </Link>
          {user ? (
            <Link href="/orders" className="btn btn--outline">
              View your orders
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ Empty cart
  if (!loading && (!cart || cart.items.length === 0)) {
    return (
      <div className="empty">
        <h2 className="empty__title">There is nothing to check out</h2>
        <p className="empty__body">Add something to your cart and come back.</p>
        <div className="section-actions">
          <Link href="/search" className="btn">
            Browse the shop
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- Loading
  if (loading || !cart) {
    return (
      <div className="loading-block">
        <span className="spinner" aria-hidden="true" />
        Preparing your checkout…
      </div>
    );
  }

  // ------------------------------------------------------------------ Form
  return (
    <div className="split">
      <form onSubmit={handleSubmit} noValidate>
        {submitError ? (
          <div className="alert alert--error" role="alert">
            <div>
              <span className="alert__title">We could not place your order</span>
              {submitError}
            </div>
          </div>
        ) : null}

        <fieldset className="fieldset">
          <legend className="fieldset__legend">Contact details</legend>

          <FormField
            id="name"
            label="Full name"
            value={form.name}
            error={errors['customer.name']}
            autoComplete="name"
            onChange={update('name')}
          />
          <FormField
            id="email"
            label="Email address"
            type="email"
            value={form.email}
            error={errors['customer.email']}
            hint="Your confirmation is sent here."
            autoComplete="email"
            onChange={update('email')}
          />
          <FormField
            id="phone"
            label="Phone number"
            type="tel"
            value={form.phone}
            error={errors['customer.phone']}
            hint="We call this number to arrange delivery."
            autoComplete="tel"
            onChange={update('phone')}
          />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset__legend">Delivery details</legend>

          <FormField
            id="address"
            label="Street address"
            value={form.address}
            error={errors['customer.address']}
            autoComplete="street-address"
            onChange={update('address')}
          />

          <FormField
            id="city"
            label="City"
            value={form.city}
            error={errors['customer.city']}
            autoComplete="address-level2"
            onChange={update('city')}
          />

          <FormField
            id="notes"
            label="Delivery notes (optional)"
            value={form.notes}
            multiline
            hint="Gate codes, landmarks or a preferred time — anything that helps us deliver."
            onChange={update('notes')}
          />
        </fieldset>

        <button type="submit" className="btn btn--block" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" /> Placing your order…
            </>
          ) : (
            <>Place order · {cart.totalLabel}</>
          )}
        </button>

        <p className="checkout__note">
          <LockIcon size={15} />
          No card details are collected here. We confirm the order and take payment directly with
          you.
        </p>
      </form>

      <OrderSummaryPanel
        lines={cart.items.map((line) => ({
          key: line.id,
          name: line.product.name,
          quantity: line.quantity,
          lineTotalLabel: line.lineTotalLabel,
        }))}
        itemCount={cart.itemCount}
        subtotalLabel={cart.subtotalLabel}
        deliveryFeeLabel={cart.deliveryFeeLabel}
        totalLabel={cart.totalLabel}
        deliveryIsFree={cart.qualifiesForFreeDelivery}
        note="Totals are calculated by our server from the current catalogue prices."
      />
    </div>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  multiline?: boolean;
}

/**
 * A labelled field with inline validation feedback.
 *
 * `aria-invalid` + `aria-describedby` mean a screen reader announces the error
 * as part of the field rather than as a detached message.
 */
function FormField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  autoComplete,
  multiline = false,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>

      {multiline ? (
        <textarea
          id={id}
          className={error ? 'textarea textarea--invalid' : 'textarea'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
      ) : (
        <input
          id={id}
          className={error ? 'input input--invalid' : 'input'}
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
      )}

      {error ? (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
