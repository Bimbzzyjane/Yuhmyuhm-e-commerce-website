import type { ViewStyle } from 'react-native';

/**
 * Brand tokens.
 *
 * Values are taken directly from the website's design system
 * (`frontend/src/app/globals.css` section 1, TOKENS) so the app and the storefront
 * stay recognisably the same brand. Anything not present in that file is derived
 * from it rather than invented.
 */
export const colors = {
  /** Page background (warm cream). */
  bg: '#faf7f1',
  /** Cards, header, footer panels. */
  surface: '#ffffff',
  /** Alternating section bands. */
  cream: '#f4efe6',
  /** Deeper cream, for placeholders and quiet panels. */
  creamDeep: '#ece4d7',
  /** Headings and filled buttons (espresso). */
  ink: '#2a1a10',
  /** Body copy (taupe). */
  inkSoft: '#6b5a4e',
  /** Meta text, stock notes, inactive navigation. */
  inkFaint: '#9a8b7d',
  /** Badges, eyebrow rules, filled accents. */
  accent: '#a8912f',
  /** Softer gold, for hairline rules on tinted surfaces. */
  accentSoft: '#c9b45f',
  /** Olive, used for the "Best Seller" badge on the website. */
  olive: '#6b6b2f',
  /** Hairline borders. */
  border: '#e9e0d3',
  /** Stronger border, for controls the shopper operates. */
  borderStrong: '#d8cbb8',
  danger: '#9b2c2c',
  success: '#2f6b47',
  /** Warm tint behind a danger message. */
  dangerSurface: '#f7ebea',
  /** Tinted surface for quiet informational panels. */
  infoSurface: '#f4efe6',
} as const;

/**
 * Corners are nearly square. `md` is the website's default radius (6px) and is
 * what cards and controls use; `sm` is for small chips, `lg` only for the larger
 * panels (e.g. the cart totals) where a little extra softness helps.
 */
export const radius = {
  sm: 4,
  md: 6,
  lg: 10,
  pill: 999,
} as const;

/**
 * Elevation.
 *
 * The website lifts surfaces with very soft shadows. These are the same idea in
 * React Native terms (iOS `shadow*`, Android `elevation`) and are used sparingly —
 * cards and one or two important panels — so the UI stays flat and quiet rather
 * than floating.
 */
export const shadow = {
  /** Product cards and information cards. */
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** One prominent panel per screen, e.g. the cart totals. */
  panel: {
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} satisfies Record<string, ViewStyle>;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
