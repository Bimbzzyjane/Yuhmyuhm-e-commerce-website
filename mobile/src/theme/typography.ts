import { Platform, type TextStyle } from 'react-native';
import { colors } from './colors';

/**
 * Typography.
 *
 * The website pairs **Playfair Display** (display/headings) with **Inter**
 * (everything else). Shipping Google font packages for this would add
 * dependencies and a font-loading gate, so the app borrows the same *contrast*
 * using platform-native families:
 *
 *   - display → the Android system serif (Noto Serif), which is a genuine
 *     editorial serif and carries the same "celebration / premium" voice;
 *   - body    → the Android system sans (Roboto), standing in for Inter.
 *
 * Sizes, weights and letter-spacing follow the website's scale, nudged slightly
 * for touch screens.
 */

/** Display/heading family. `serif` resolves to the platform's serif face. */
export const fontDisplay = Platform.select({ android: 'serif', default: 'serif' }) as string;

/** Body/UI family. Leaving this undefined keeps the platform default. */
export const fontBody = Platform.select({ android: 'sans-serif', default: undefined });

export const type = {
  /** Uppercase gold label, as above every heading on the website. */
  eyebrow: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.accent,
  },

  /** The brand wordmark — serif, generous tracking. */
  wordmark: {
    fontFamily: fontDisplay,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: colors.ink,
  },

  /** Screen-level heading. */
  h1: {
    fontFamily: fontDisplay,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.ink,
  },

  /** Section / card heading. */
  h2: {
    fontFamily: fontDisplay,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.ink,
  },

  /** Product title — sans on the website too, deliberately not serif. */
  title: {
    fontFamily: fontBody,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.ink,
  },

  /** Price — the website's `--text-lg` at weight 700. */
  price: {
    fontFamily: fontBody,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.ink,
  },

  /** Body copy. */
  body: {
    fontFamily: fontBody,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
  },

  /** Small secondary copy. */
  bodySmall: {
    fontFamily: fontBody,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkSoft,
  },

  /** Meta text: stock notes, hints, timestamps. */
  meta: {
    fontFamily: fontBody,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkFaint,
  },

  /** Button label — uppercase with the website's wide tracking. */
  button: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  /** Input label — small, uppercase, quiet. */
  inputLabel: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },

  /** Input value. */
  input: {
    fontFamily: fontBody,
    fontSize: 16,
    color: colors.ink,
  },
} satisfies Record<string, TextStyle>;