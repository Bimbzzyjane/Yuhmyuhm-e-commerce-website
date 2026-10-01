'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, orderStatusLabel } from '@/lib/format';
import type { Order } from '@/lib/types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { OrderSummaryPanel } from './OrderSummaryPanel';

/**
 * A single order.
 *
 * `GET /api/orders/:id` is owner-only, so a 403 or 404 is presented the same
 * way ("we could not find that order") — that avoids confirming whether a given
 * order id exists.
 */
export function OrderDetailView({ orderId }: { orderId: string }) {
  const { ready, accessToken } = useAuth();

  /*
   * As in OrdersView, the fetched result is boxed with the request key
   * (token + order id) it belongs to. A change of key simply means the old box
   * no longer matches, so nothing stale is ever rendered and no effect has to
   * reset state.
   */
  const requestKey = `${accessToken ?? 'anonymous'}:${orderId}`;
  const [result, setResult] = useState<{ key: string; order: Order } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);

  const order = result?.key === requestKey ? result.order : null;
  const error = failure?.key === requestKey ? failure.message : null;

  useEffect(() => {
    if (!ready || !accessToken) return;

    let cancelled = false;

    api
      .order(orderId, accessToken)
      .then(({ data }) => {
        if (cancelled) return;
        setResult({ key: requestKey, order: data });
        // Clear any earlier failure so a retry cannot show a stale error.
        setFailure(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError && (caught.status === 403 || caught.status === 404)) {
          // Same message for both: this avoids confirming whether an id exists.
          setFailure({ key: requestKey, message: 'We could not find that order on your account.' });
          return;
        }
        setFailure({
          key: requestKey,
          message: caught instanceof ApiError ? caught.message : 'We could not load that order.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [ready, accessToken, orderId, requestKey]);

  if (!ready) {
    return (
      <div className="loading-block">
        <span className="spinner" aria-hidden="true" />
        Checking your session…
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="empty">
        <h2 className="empty__title">Sign in to view this order</h2>
        <p className="empty__body">Order details are tied to the account that placed them.</p>
        <div className="auth__card" style={{ marginTop: 'var(--space-4)' }}>
          <GoogleSignInButton next={`/orders/${orderId}`} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <div className="alert alert--error" role="alert">
          <div>
            <span className="alert__title">Order unavailable</span>
            {error}
          </div>
        </div>
        <Link href="/orders" className="btn btn--outline btn--sm">
          Back to your orders
        </Link>
      </>
    );
  }

  if (!order) {
    return (
      <div className="loading-block">
        <span className="spinner" aria-hidden="true" />
        Loading your order…
      </div>
    );
  }

  return (
    <>
      <div className="order-card">
        <div className="order-card__head">
          <div>
            <p className="order-card__number">{order.orderNumber}</p>
            <p className="order-card__meta">Placed {formatDateTime(order.createdAt)}</p>
          </div>
          <span className={`status status--${order.status}`}>{orderStatusLabel(order.status)}</span>
        </div>

        <div className="order-card__lines">
          {order.items.map((item) => (
            <div className="order-card__line" key={item.id}>
              <span>
                {item.productSlug ? (
                  <Link href={`/products/${item.productSlug}`}>{item.productName}</Link>
                ) : (
                  item.productName
                )}{' '}
                × {item.quantity}
                <span className="muted"> · {item.unitPriceLabel} each</span>
              </span>
              <span className="nowrap">{item.lineTotalLabel}</span>
            </div>
          ))}
        </div>

        <div className="definition-grid">
          <div>
            <h2 className="footer__heading">Contact</h2>
            <dl className="data-list">
              <dt>Name</dt>
              <dd>{order.customerName}</dd>
              <dt>Email</dt>
              <dd>{order.email}</dd>
              <dt>Phone</dt>
              <dd>{order.phone}</dd>
            </dl>
          </div>
          <div>
            <h2 className="footer__heading">Delivery</h2>
            <dl className="data-list">
              <dt>Address</dt>
              <dd>{order.deliveryAddress}</dd>
              <dt>City</dt>
              <dd>{order.deliveryCity}</dd>
              {order.deliveryNotes ? (
                <>
                  <dt>Notes</dt>
                  <dd>{order.deliveryNotes}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-5)' }}>
        <OrderSummaryPanel
          title="Order total"
          lines={order.items.map((item) => ({
            key: item.id,
            name: item.productName,
            quantity: item.quantity,
            lineTotalLabel: item.lineTotalLabel,
          }))}
          itemCount={order.itemCount}
          subtotalLabel={order.subtotalLabel}
          deliveryFeeLabel={order.deliveryFeeLabel}
          totalLabel={order.totalLabel}
          deliveryIsFree={order.deliveryFee === 0}
          note="These figures are locked to the prices at the time you ordered."
        />
      </div>

      <div className="section-actions" style={{ justifyContent: 'flex-start' }}>
        <Link href="/orders" className="btn btn--ghost">
          Back to your orders
        </Link>
        <Link href="/search" className="btn btn--outline">
          Continue shopping
        </Link>
      </div>
    </>
  );
}
