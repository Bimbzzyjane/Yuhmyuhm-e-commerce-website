import { describe, expect, it } from 'vitest';
import { formatMoney, fromMinor, sumMinor, toMinor } from '../src/utils/money';

/**
 * Money is the one place a rounding bug costs real money, so these are the
 * cheapest and most valuable tests in the suite.
 */
describe('money', () => {
  describe('toMinor', () => {
    it('converts major units to integer kobo', () => {
      expect(toMinor(45000)).toBe(4_500_000);
      expect(toMinor('45000.00')).toBe(4_500_000);
      expect(toMinor('18500.50')).toBe(1_850_050);
      expect(toMinor(0)).toBe(0);
    });

    it('rounds half away from zero instead of drifting', () => {
      expect(toMinor(0.005)).toBe(1);
      expect(toMinor('0.004')).toBe(0);
      expect(toMinor(19.999)).toBe(2000);
    });

    it('handles negatives (refunds/credits)', () => {
      expect(toMinor('-12.34')).toBe(-1234);
    });

    it('rejects non-numeric input rather than silently producing NaN', () => {
      expect(() => toMinor('not-a-number')).toThrow(TypeError);
      expect(() => toMinor(Number.NaN)).toThrow(TypeError);
    });
  });

  describe('fromMinor', () => {
    it('renders the fixed 2-decimal string Postgres expects', () => {
      expect(fromMinor(4_500_000)).toBe('45000.00');
      expect(fromMinor(1_850_050)).toBe('18500.50');
      expect(fromMinor(5)).toBe('0.05');
      expect(fromMinor(0)).toBe('0.00');
      expect(fromMinor(-1234)).toBe('-12.34');
    });

    it('round-trips through toMinor for typical catalogue prices', () => {
      for (const major of [15000, 28000, 45000, 18500.5, 350000]) {
        expect(toMinor(fromMinor(toMinor(major)))).toBe(toMinor(major));
      }
    });
  });

  describe('formatMoney', () => {
    it('omits decimals for whole naira amounts', () => {
      expect(formatMoney(4_500_000)).toBe('₦45,000');
      expect(formatMoney(35_000_000)).toBe('₦350,000');
    });

    it('shows two decimals only when needed', () => {
      expect(formatMoney(1_850_050)).toBe('₦18,500.50');
    });

    it('handles zero and negatives', () => {
      expect(formatMoney(0)).toBe('₦0');
      expect(formatMoney(-1234)).toBe('-₦12.34');
    });

    it('falls back to the ISO code for unknown currencies', () => {
      expect(formatMoney(1234, 'ZAR')).toBe('ZAR 12.34');
    });
  });

  describe('sumMinor', () => {
    it('adds integer amounts exactly', () => {
      // The classic float trap: 0.1 + 0.2 !== 0.3. In kobo it is exact.
      expect(sumMinor([10, 20])).toBe(30);
      expect(sumMinor([])).toBe(0);
      expect(sumMinor([4_500_000, 1_850_050, 3])).toBe(6_350_053);
    });
  });
});
