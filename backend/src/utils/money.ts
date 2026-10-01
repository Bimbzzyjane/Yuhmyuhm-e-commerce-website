/**
 * Money handling.
 *
 * ---------------------------------------------------------------------------
 * THE RULE: all monetary arithmetic in this codebase uses integer MINOR units
 * (kobo for NGN). Never use a floating point number to compute a total.
 * ---------------------------------------------------------------------------
 *
 * Postgres stores `numeric(12,2)` in major units so the data is human readable
 * in the Supabase table editor. Repositories convert on the way in/out
 * (`toMinor` / `fromMinor`) and every service works in integers.
 *
 * API responses expose money as integer minor units, plus a preformatted
 * `*Label` string so clients never need to do currency maths themselves.
 */

const MINOR_UNITS_PER_MAJOR = 100;

/** Currency symbol map. Falls back to the ISO code for anything unknown. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '\u20A6', // ₦
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

export const DEFAULT_CURRENCY = 'NGN';

/**
 * Converts a major-unit value (e.g. `"45000.00"` from Postgres, or `45000`)
 * into integer minor units (`4500000`). Rounds half-away-from-zero so that
 * `0.005` becomes `1` rather than banker's-rounding to `0`.
 */
export function toMinor(value: number | string): number {
  const major = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(major)) {
    throw new TypeError(`Cannot convert a non-numeric money value: ${String(value)}`);
  }
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
}

/**
 * Converts integer minor units back into the fixed 2-decimal string Postgres
 * expects (`4500000` -> `"45000.00"`).
 */
export function fromMinor(minor: number): string {
  if (!Number.isFinite(minor)) {
    throw new TypeError(`Cannot convert a non-numeric minor value: ${String(minor)}`);
  }
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(minor));
  const major = Math.floor(absolute / MINOR_UNITS_PER_MAJOR);
  const fraction = absolute % MINOR_UNITS_PER_MAJOR;
  return `${sign}${major}.${String(fraction).padStart(2, '0')}`;
}

/** `4500000` -> `"₦45,000"`, `4500050` -> `"₦45,000.50"`. */
export function formatMoney(minor: number, currency: string = DEFAULT_CURRENCY): string {
  const rounded = Math.round(minor);
  const major = Math.abs(rounded) / MINOR_UNITS_PER_MAJOR;
  const hasFraction = Math.abs(rounded) % MINOR_UNITS_PER_MAJOR !== 0;

  let grouped: string;
  try {
    grouped = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    grouped = hasFraction ? major.toFixed(2) : String(major);
  }

  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
  return `${rounded < 0 ? '-' : ''}${symbol}${grouped}`;
}

/** Sums minor units without ever touching a float. */
export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => total + Math.round(value), 0);
}

export const MONEY = {
  MINOR_UNITS_PER_MAJOR,
  toMinor,
  fromMinor,
  formatMoney,
  sumMinor,
} as const;
