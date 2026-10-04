import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, radius, shadow, space } from '../theme/colors';
import { type } from '../theme/typography';

export interface CardProps {
  title?: string;
  hint?: string;
  children: ReactNode;
}

/** A bordered surface, matching the website's hairline-bordered cards. */
export function Card({ title, hint, children }: CardProps) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** Label above a value — the repeated "API URL", "Email" pattern. */
export function DetailRow({
  label,
  value,
  tone = 'default',
  selectable = false,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'muted';
  selectable?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        selectable={selectable}
        style={[
          styles.detailValue,
          tone === 'warning' && styles.detailWarning,
          tone === 'muted' && styles.detailMuted,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export interface StateViewProps {
  title: string;
  message?: string | null;
  tone?: 'neutral' | 'error';
  busy?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centred loading / error / empty state, used where a list would be. */
export function StateView({
  title,
  message,
  tone = 'neutral',
  busy = false,
  actionLabel,
  onAction,
}: StateViewProps) {
  return (
    <View style={styles.state}>
      {busy ? <ActivityIndicator size="large" color={colors.accent} /> : null}
      <Text style={[styles.stateTitle, tone === 'error' && styles.stateTitleError]}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Text onPress={onAction} style={styles.stateAction}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
    ...shadow.card,
  },
  cardTitle: {
    ...type.h2,
  },
  cardHint: {
    ...type.bodySmall,
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    ...type.inputLabel,
    color: colors.inkFaint,
  },
  detailValue: {
    ...type.body,
    fontSize: 15,
    color: colors.ink,
  },
  detailWarning: {
    color: colors.danger,
  },
  detailMuted: {
    color: colors.inkFaint,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  stateTitle: {
    ...type.h2,
    textAlign: 'center',
  },
  stateTitleError: {
    color: colors.danger,
  },
  stateMessage: {
    ...type.body,
    textAlign: 'center',
  },
  stateAction: {
    ...type.body,
    fontWeight: '600',
    color: colors.accent,
  },
});
