import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenBrand } from '../components/Brand';
import { Button, LinkButton } from '../components/Button';
import { Card, StateView } from '../components/Card';
import { ProductThumb } from '../components/ProductThumb';
import { QuantityStepper } from '../components/QuantityStepper';
import { Screen } from '../components/Screen';
import { useCart } from '../context/CartProvider';
import type { CartLine } from '../lib/types';
import type { TabScreenProps } from '../navigation/types';
import { colors, radius, shadow, space } from '../theme/colors';
import { type } from '../theme/typography';

/**
 * Cart tab.
 *
 * Renders exactly what the API returned — quantities, unit prices, line totals,
 * subtotal, delivery fee and total all come from the cart DTO, which the backend
 * recomputes from the catalogue on every read. Nothing is calculated here, so
 * the figures can never disagree with the website.
 *
 * Every mutation (increase, decrease, remove, clear) sends the request and
 * adopts the complete cart response, so the screen always shows the server's
 * state rather than an optimistic guess.
 */
export function CartScreen({ navigation }: TabScreenProps<'Cart'>) {
  const {
    cart,
    itemCount,
    loading,
    mutating,
    error,
    authenticated,
    updateItem,
    removeItem,
    clear,
    refresh,
  } = useCart();

  const [clearing, setClearing] = useState(false);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);

  const handleClear = useCallback(async () => {
    setClearing(true);
    await clear();
    setClearing(false);
  }, [clear]);

  /** Decreasing from 1 removes the line through PATCH `quantity: 0`. */
  const handleDecrement = useCallback(
    async (line: CartLine) => {
      setPendingLineId(line.id);
      if (line.quantity <= 1) await updateItem(line.id, 0);
      else await updateItem(line.id, line.quantity - 1);
      setPendingLineId(null);
    },
    [updateItem],
  );

  const handleIncrement = useCallback(
    async (line: CartLine) => {
      setPendingLineId(line.id);
      await updateItem(line.id, line.quantity + 1);
      setPendingLineId(null);
    },
    [updateItem],
  );

  const handleRemove = useCallback(
    async (line: CartLine) => {
      setPendingLineId(line.id);
      await removeItem(line.id);
      setPendingLineId(null);
    },
    [removeItem],
  );

  if (loading) {
    return (
      <Screen>
        <StateView busy title="Loading your cart…" />
      </Screen>
    );
  }

  if (error && !cart) {
    return (
      <Screen>
        <StateView
          tone="error"
          title="We could not load your cart"
          message={error}
          actionLabel="Retry"
          onAction={() => void refresh()}
        />
      </Screen>
    );
  }

  if (!cart || itemCount === 0) {
    return (
      <Screen>
        <StateView
          title="Your cart is empty"
          message="Browse the shop and add something — a cake or a piece of equipment."
          actionLabel="Browse the shop"
          onAction={() => navigation.navigate('Shop')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={cart.items}
        keyExtractor={(line) => line.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => {
          const busy = mutating && pendingLineId === item.id;
          return (
            <View style={styles.line}>
              <View style={styles.lineTop}>
                <ProductThumb
                  uri={item.product.imageUrl}
                  name={item.product.name}
                  size={64}
                  compact
                />
                <View style={styles.lineBody}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.lineUnit}>{item.unitPriceLabel} each</Text>
                  {item.exceedsStock ? (
                    <Text style={styles.warning}>Only {item.product.stockQuantity} in stock</Text>
                  ) : null}
                </View>
                <Text style={styles.lineTotal}>{item.lineTotalLabel}</Text>
              </View>

              <View style={styles.lineControls}>
                <QuantityStepper
                  value={item.quantity}
                  busy={busy}
                  onDecrement={() => void handleDecrement(item)}
                  onIncrement={() => void handleIncrement(item)}
                />
                <LinkButton
                  label="Remove"
                  tone="danger"
                  disabled={mutating}
                  onPress={() => void handleRemove(item)}
                />
              </View>
            </View>
          );
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenBrand />
            {!authenticated ? (
              <Card
                title="Shopping as a guest"
                hint="This cart is tied to this device. Sign in and it merges into your account — and shows up on the website too."
              >
                <Button label="Sign in" onPress={() => navigation.navigate('SignIn')} />
              </Card>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <View style={styles.totals}>
              <Row label="Subtotal" value={cart.subtotalLabel} />
              <Row
                label="Delivery"
                value={cart.deliveryFeeLabel}
                muted={cart.qualifiesForFreeDelivery}
              />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{cart.totalLabel}</Text>
              </View>
            </View>

            {cart.qualifiesForFreeDelivery ? (
              <Text style={styles.freeNote}>Your order qualifies for free delivery.</Text>
            ) : null}

            <Button
              label={`Checkout · ${cart.totalLabel}`}
              onPress={() => navigation.navigate('Checkout')}
            />

            <Text style={styles.note}>
              Your cart lives on our servers, so it will be waiting on the website and on your other
              device.
            </Text>

            <Button
              label="Empty cart"
              variant="ghost"
              busy={clearing || mutating}
              onPress={() => void handleClear()}
            />
          </View>
        }
      />
    </Screen>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.totalsRow}>
      <Text style={styles.totalsLabel}>{label}</Text>
      <Text style={[styles.totalsValue, muted && styles.totalsMuted]}>{value}</Text>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  header: {
    gap: space.md,
    marginBottom: space.lg,
  },
  line: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
    ...shadow.card,
  },
  lineTop: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
  },
  lineBody: {
    flex: 1,
    gap: 2,
  },
  lineName: {
    ...type.title,
  },
  lineUnit: {
    ...type.meta,
  },
  lineTotal: {
    ...type.price,
    fontSize: 16,
    lineHeight: 22,
  },
  lineControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warning: {
    ...type.meta,
    color: colors.danger,
    fontWeight: '600',
  },
  separator: {
    height: space.md,
  },
  footer: {
    marginTop: space.lg,
    gap: space.md,
  },
  /* The one elevated panel on this screen — the money must be unmissable. */
  totals: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    ...shadow.panel,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalsLabel: {
    ...type.body,
  },
  totalsValue: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
  },
  totalsMuted: {
    color: colors.success,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
  totalLabel: {
    ...type.price,
    fontSize: 16,
  },
  totalValue: {
    ...type.price,
  },
  freeNote: {
    ...type.meta,
    color: colors.success,
    fontWeight: '600',
  },
  note: {
    ...type.meta,
  },
  errorBanner: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 13,
    lineHeight: 18,
  },
});
