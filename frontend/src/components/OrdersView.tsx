'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, orderStatusLabel } from '@/lib/format';
import type { Order } from '@/lib/types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PackageIcon } from './Icons';

/**
 * Order history.
 *
 * Only signed-in shoppers have order history — a guest order deliberately
 * cannot be listed afterwards, because that would let anyone enumerate orders.
 * A guest still sees their confirmation on the checkout screen.
 */
export function OrdersView() {
  const { ready, accessToken } = useAuth();

  /*
   * Results are stored WITH the token they were fetched for, and only rendered
   * when that token is still the current one. That removes the need to clear
   * state when the session changes (which would be a cascading render), while
   * still guaranteeing one shopper never sees another's orders.
   */
  const [result, setResult] = useState<{ token: string; orders: Order[] } | null>(null);
  const [failure, setFailure] = useState<{ token: string; message: string } | null>(null);

  const orders = accessToken && result?.token === accessToken ? result.orders : null;
  const error = accessToken && failure?.token === accessToken ? failure.message : null;

  useEffect(() => {
    if (!ready || !accessToken) return;

    let cancelled = false;

    api
      .orders(accessToken)
      .then(({ data }) => {
        if (cancelled) return;
        setResult({ token: accessToken, orders: data });
        // Clear any earlier failure so a retry cannot show a stale error.
        setFailure(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setFailure({
          token: accessToken,
          message: caught instanceof ApiError ? caught.message : 'We could not load your orders.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [ready, accessToken]);

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
        <span className="empty__icon" aria-hidden="true">
          <PackageIcon size={28} />
        </span>
        <h2 className="empty__title">Sign in to see your orders</h2>
        <p className="empty__body">
          Your order history lives with your account. Sign in with Google and we will link any order
          you place from now on.
        </p>
        <div className="auth__card" style={{ marginTop: 'var(--space-4)' }}>
          <GoogleSignInButton next="/orders" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert--error" role="alert">
        <div>
          <span className="alert__title">We could not load your orders</span>
          {error}
        </div>
      </div>
    );
  }

  if (!orders) {
    return (
      <div className="loading-block">
        <span className="spinner" aria-hidden="true" />
        Loading your orders…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="empty">
        <span className="empty__icon" aria-hidden="true">
          <PackageIcon size={28} />
        </span>
        <h2 className="empty__title">No orders yet</h2>
        <p className="empty__body">
          When you place an order it will appear here, with its confirmation and status.
        </p>
        <div className="section-actions">
          <Link href="/search" className="btn">
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul>
      {orders.map((order) => (
        <li className="order-card" key={order.id}>
          <div className="order-card__head">
            <div>
              <p className="order-card__number">{order.orderNumber}</p>
              <p className="order-card__meta">Placed {formatDateTime(order.createdAt)}</p>
            </div>
            <span className={`status status--${order.status}`}>
              {orderStatusLabel(order.status)}
            </span>
          </div>

          <div className="order-card__lines">
            {order.items.map((item) => (
              <div className="order-card__line" key={item.id}>
                <span>
                  {item.productName} × {item.quantity}
                </span>
                <span className="nowrap">{item.lineTotalLabel}</span>
              </div>
            ))}
          </div>

          <div className="order-card__foot">
            <span className="muted">
              {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {order.deliveryCity}
            </span>
            <span className="order-card__total">{order.totalLabel}</span>
            <Link href={`/orders/${order.id}`} className="btn btn--outline btn--sm">
              View details
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
