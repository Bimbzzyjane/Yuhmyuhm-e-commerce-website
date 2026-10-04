import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/colors';

export interface QuantityStepperProps {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  busy?: boolean;
}

/**
 * Minus / value / plus, matching the website's `.qty` control.
 *
 * The caller decides what decrementing below 1 means — the cart screen turns it
 * into a `PATCH` with `quantity: 0`, which is the API's way of removing a line.
 * The buttons keep a 44pt touch target, which is larger than the website's 36px
 * because a phone needs it.
 */
export function QuantityStepper({
  value,
  onDecrement,
  onIncrement,
  busy = false,
}: QuantityStepperProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Decrease quantity"
        accessibilityRole="button"
        disabled={busy}
        onPress={onDecrement}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}
      >
        <Text style={styles.glyph}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        accessibilityLabel="Increase quantity"
        accessibilityRole="button"
        disabled={busy}
        onPress={onIncrement}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}
      >
        <Text style={styles.glyph}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.cream,
  },
  disabled: {
    opacity: 0.5,
  },
  glyph: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 20,
  },
  value: {
    minWidth: 32,
    textAlign: 'center',
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
});
