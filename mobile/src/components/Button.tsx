import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radius, space } from '../theme/colors';
import { type } from '../theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** `sm` is the compact control used inside product cards. */
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. */
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

/*
 * Matches the website's `.btn` family: a filled ink button, an outlined twin, and
 * two deliberately quiet text-only actions. Ghost and danger are intentionally
 * NOT filled buttons — the mobile UI should not shout at the shopper.
 */
const container: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.ink, borderColor: colors.ink },
  secondary: { backgroundColor: colors.surface, borderColor: colors.ink },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderColor: 'transparent' },
};

const labelColour: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.surface },
  secondary: { color: colors.ink },
  ghost: { color: colors.inkSoft },
  danger: { color: colors.danger },
};

const box: Record<ButtonSize, ViewStyle> = {
  md: { paddingVertical: space.md, paddingHorizontal: space.xl },
  sm: { paddingVertical: space.sm, paddingHorizontal: space.md },
};

/** A quiet text action — the website's `.btn--ghost` / `.btn--danger`. */
export function LinkButton({
  label: text,
  onPress,
  tone = 'default',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const colour =
    tone === 'danger' ? colors.danger : tone === 'accent' ? colors.accent : colors.inkSoft;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
    >
      <Text style={[styles.linkLabel, { color: colour }]}>{text}</Text>
    </Pressable>
  );
}

export function Button({
  label: text,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  busy = false,
  style,
}: ButtonProps) {
  const inactive = disabled || busy;
  const filled = variant === 'primary';
  const spinnerTint = filled ? colors.surface : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        container[variant],
        box[size],
        inactive && styles.buttonInactive,
        pressed && !inactive && styles.buttonPressed,
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={spinnerTint} /> : null}
      <Text
        style={[
          type.button,
          size === 'sm' && styles.buttonLabelSmall,
          labelColour[variant],
        ]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 44, // comfortable touch target, even at `size="sm"`
  },
  buttonInactive: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabelSmall: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  link: {
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
