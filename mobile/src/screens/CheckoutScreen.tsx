import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Eyebrow } from '../components/Brand';
import { Button } from '../components/Button';
import { Card, StateView } from '../components/Card';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthProvider';
import { useCart } from '../context/CartProvider';
import { api, apiErrorMessage, fieldErrorsFrom } from '../lib/api';
import type { CartLine } from '../lib/types';
import type { RootScreenProps } from '../navigation/types';
import { colors, radius, space } from '../theme/colors';
import { type } from '../theme/typography';

/**
 * Checkout.
 *
 * Collects CONTACT AND DELIVERY DETAILS ONLY. No price is ever submitted: the API
 * re-reads every product and recomputes the subtotal, delivery fee and total, so
 * nothing sent from this screen can influence what is charged. Every figure shown
 * is the `*Label` the API already sent with the cart.
 *
 * On success the order is handed to the confirmation screen and the cart is
 * re-read, because the backend consumed it.
 */

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
}

const DEFAULT_CITY = 'Lagos';

/** Client-side mirrors of the backend's `CheckoutSchema` minimums, so obvious
 *  problems are caught before a round trip. The server remains authoritative. */
function validate(form: FormState): Record<string, string> {
  const problems: Record<string, string> = {};
  const add = (path: string, ok: boolean, message: string) => {
    if (!ok) problems[path] = message;
  };

  add(
    'customer.name',
    form.name.trim().length >= 2,
    'Enter the name for the order.',
  );
  add(
    'customer.email',
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
    'Enter a valid email address.',
  );
  add('customer.phone', form.phone.trim().length >= 7, 'Enter a phone number we can reach.');
  add(
    'customer.address',
    form.address.trim().length >= 5,
    'Enter the delivery address.',
  );
  add('customer.city', form.city.trim().length >= 2, 'Enter a delivery city.');

  return problems;
}

export function CheckoutScreen({ navigation }: RootScreenProps<'Checkout'>) {
  const { user, profile } = useAuth();
  const { cart, loading, refresh, credentials } = useCart();

  const [draft, setDraft] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /*
   * Prefill is DERIVED, not synced in an effect: the profile arrives
   * asynchronously, so the shopper sees the profile until they edit a field, after
   * which their own input always wins and is never overwritten.
   */
  const form: FormState = {
    name: draft?.name ?? profile?.fullName ?? '',
    email: draft?.email ?? user?.email ?? profile?.email ?? '',
    phone: draft?.phone ?? profile?.phone ?? '',
    address: draft?.address ?? '',
    city: draft?.city ?? DEFAULT_CITY,
    notes: draft?.notes ?? '',
  };

  const update = (field: keyof FormState) => (value: string) => {
    setDraft((current) => ({ ...form, ...current, [field]: value }));
    setErrors((current) => {
      if (!current[`customer.${field}`]) return current;
      const next = { ...current };
      delete next[`customer.${field}`];
      return next;
    });
  };

  const submit = async () => {
    if (submitting) return; // guards a double tap

    const problems = validate(form);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      setSubmitError('Please check the highlighted fields.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setErrors({});

    try {
      const order = await api.placeOrder(
        {
          customer: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          },
        },
        // Bearer token when signed in, guest cart header otherwise.
        await credentials(),
      );

      // The API consumed the cart; re-reading adopts the emptied one and clears
      // the tab badge, with no separate cart state anywhere.
      await refresh();

      // `replace`, not `push`: going back to a checkout for a consumed cart would
      // be a dead end.
      navigation.replace('OrderConfirmation', { order });
    } catch (caught) {
      // Surface per-field problems when the API reports them, plus its message.
      setErrors(fieldErrorsFrom(caught));
      setSubmitError(apiErrorMessage(caught, 'We could not place your order. Please try again.'));
      // The draft is untouched and the cart is NOT cleared, so retrying is safe.
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <StateView busy title="Loading your cart…" />
      </Screen>
    );
  }

  if (!cart || cart.itemCount === 0) {
    return (
      <Screen>
        <StateView
          title="Your cart is empty"
          message="Add something from the shop before checking out."
          actionLabel="Browse the shop"
          onAction={() => navigation.navigate('Tabs', { screen: 'Shop' })}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Eyebrow>Checkout</Eyebrow>

          <Card
            title="Delivery details"
            hint="We use these to confirm the order and arrange delivery."
          >
            <TextField
              label="Full name"
              value={form.name}
              onChangeText={update('name')}
              placeholder="Chioma Okafor"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              error={errors['customer.name']}
              editable={!submitting}
            />
            <TextField
              label="Email"
              value={form.email}
              onChangeText={update('email')}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              error={errors['customer.email']}
              editable={!submitting}
            />
            <TextField
              label="Phone number"
              value={form.phone}
              onChangeText={update('phone')}
              placeholder="0803 000 0000"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              error={errors['customer.phone']}
              editable={!submitting}
            />
            <TextField
              label="Delivery address"
              value={form.address}
              onChangeText={update('address')}
              placeholder="12 Admiralty Way, Lekki Phase 1"
              autoCapitalize="sentences"
              error={errors['customer.address']}
              editable={!submitting}
            />
            <TextField
              label="City"
              value={form.city}
              onChangeText={update('city')}
              placeholder={DEFAULT_CITY}
              autoCapitalize="words"
              error={errors['customer.city']}
              editable={!submitting}
            />
            <TextField
              label="Delivery notes (optional)"
              value={form.notes}
              onChangeText={update('notes')}
              placeholder="Gate codes, landmarks or a preferred time."
              autoCapitalize="sentences"
              error={errors['customer.notes']}
              editable={!submitting}
            />
          </Card>

          <Card title="Order summary">
            {cart.items.map((line) => (
              <SummaryLine key={line.id} line={line} />
            ))}

            <View style={styles.rule} />

            <TotalRow label="Subtotal" value={cart.subtotalLabel} />
            <TotalRow
              label="Delivery"
              value={cart.deliveryFeeLabel}
              muted={cart.qualifiesForFreeDelivery}
            />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{cart.totalLabel}</Text>
            </View>

            <Text style={styles.hint}>
              Totals are calculated by our server from the current catalogue prices.
            </Text>
          </Card>

          {submitError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {submitError}
            </Text>
          ) : null}

          <Button
            label={`Place order · ${cart.totalLabel}`}
            busy={submitting}
            onPress={() => void submit()}
          />

          <Text style={styles.note}>
            No card details are collected here. We confirm the order and take payment directly with
            you.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** One catalogue line in the summary: name, quantity and the server's line total. */
function SummaryLine({ line }: { line: CartLine }) {
  return (
    <View style={styles.summaryLine}>
      <View style={styles.summaryText}>
        <Text style={styles.summaryName} numberOfLines={2}>
          {line.product.name}
        </Text>
        <Text style={styles.summaryMeta}>
          {line.unitPriceLabel} × {line.quantity}
        </Text>
      </View>
      <Text style={styles.summaryTotal}>{line.lineTotalLabel}</Text>
    </View>
  );
}

function TotalRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.totalRowLine}>
      <Text style={styles.totalRowLabel}>{label}</Text>
      <Text style={[styles.totalRowValue, muted && styles.muted]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryName: {
    ...type.title,
  },
  summaryMeta: {
    ...type.meta,
  },
  summaryTotal: {
    ...type.price,
    fontSize: 15,
    lineHeight: 21,
  },
  rule: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.xs,
  },
  totalRowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalRowLabel: {
    ...type.body,
  },
  totalRowValue: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
  },
  muted: {
    color: colors.success,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.xs,
  },
  totalLabel: {
    ...type.price,
  },
  totalValue: {
    ...type.price,
  },
  hint: {
    ...type.meta,
  },
  error: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    ...type.meta,
  },
});