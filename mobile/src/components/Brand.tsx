import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, space } from '../theme/colors';
import { type } from '../theme/typography';

/**
 * Brand primitives, matching the website's `.eyebrow` treatment: a short gold
 * rule followed by an uppercase, widely-tracked gold label.
 */

/** A 28×1px gold rule, exactly as the website draws its eyebrow rule. */
export function GoldRule({ width = 28 }: { width?: number }) {
  return <View style={[styles.rule, { width }]} />;
}

export function Eyebrow({
  children,
  trailing,
}: {
  children: ReactNode;
  /** Optional right-aligned companion, e.g. a count or a link. */
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.eyebrowRow}>
      <View style={styles.eyebrowLeft}>
        <GoldRule />
        <Text style={type.eyebrow}>{children}</Text>
      </View>
      {trailing}
    </View>
  );
}

/**
 * The compact brand strip that sits at the top of each tab's content: gold rule,
 * serif wordmark, and the gold "CATERING SERVICES" lockup.
 *
 * Deliberately one short row (~22pt) rather than a stacked masthead, so the app
 * still reads as a native app rather than a squeezed-down website.
 */
export function ScreenBrand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandLeft}>
        <GoldRule />
        <Text style={type.wordmark}>Yuhmyuhm</Text>
      </View>
      <Text style={styles.brandTag}>Catering Services</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rule: {
    height: 1,
    backgroundColor: colors.accent,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  brandTag: {
    ...type.eyebrow,
    fontSize: 9,
    letterSpacing: 1.8,
  },
});