import type { OrderStatus } from './types';

/**
 * Display formatting.
 *
 * Currency always comes from the server as a pre-rendered `*Label`, so this
 * module is only needed for client-side values and for dates. It still
 * implements the exact same rule as the backend so a locally computed figure
 * can never disagree with the API: integer minor units in, formatted string out.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '\u20A6', // ₦
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

/** `4500000` -> `"₦45,000"`. Mirrors backend `formatMoney`. */
export function formatMoney(minor: number, currency = 'NGN'): string {
  const rounded = Math.round(minor);
  const hasFraction = Math.abs(rounded) % 100 !== 0;

  const grouped = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(rounded) / 100);

  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
  return `${rounded < 0 ? '-' : ''}${symbol}${grouped}`;
}

/** Long, timezone-aware date used on order rows. */
export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'long',
      timeZone: 'Africa/Lagos',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Lagos',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Order received',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Pluralises a count without pulling in an i18n library. */
export function pluralise(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
