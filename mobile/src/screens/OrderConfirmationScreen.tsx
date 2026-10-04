import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GoldRule } from '../components/Brand';
import { Button } from '../components/Button';
import { Card, DetailRow } from '../components/Card';
import { Screen } from '../components/Screen';
import type { RootScreenProps } from '../navigation/types';
import { colors, radius, shadow, space } from '../theme/colors';
import { fontDisplay, type } from '../theme/typography';

/**
 * Order confirmation.
 *
 * Renders the order object exactly as `POST /api/orders` returned it — the order
 * number, the snapshotted lines and every total come from the server, so what the
 * shopper sees is what was stored.
 *
 * The cart is already empty by this point (the backend consumed it and the app
 * re-read it), so this screen only confirms.
 */
export function OrderConfirmationScreen({ navigation, route }: RootScreenProps<'OrderConfirmation'>) {
  const { order } = route.params;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <GoldRule width={space.xl} />
          <Text style={styles.title}>Thank you, {order.customerName.split(' ')[0]}.</Text>
          <Text style={styles.subtitle}>
            Your order is confirmed and is now with our kitchen team. A member of the team will call
            you on {order.phone} to arrange payment and delivery.
          </Text>
        </View>

        <Card title="Order reference">
          <Text style={styles.orderNumber} selectable>
            {order.orderNumber}
          </Text>
          <Text style={styles.hint}>
            Keep this reference for your records. A confirmation has also been emailed to{' '}
            {order.email}.
          </Text>
        </Card>

        <Card title="What you ordered">
          {order.items.map((line) => (
            <View key={line.id} style={styles.line}>
              <View style={styles.lineText}>
                <Text style={styles.lineName} numberOfLines={2}>
                  {line.productName}
                </Text>
                <Text style={styles.lineMeta}>
                  {line.unitPriceLabel} × {line.quantity}
                </Text>
              </View>
              <Text style={styles.lineTotal}>{line.lineTotalLabel}</Text>
            </View>
          ))}

          <View style={styles.rule} />

          <Row label="Subtotal" value={order.subtotalLabel} />
          <Row label="Delivery" value={order.deliveryFeeLabel} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{order.totalLabel}</Text>
          </View>
        </Card>

        <Card title="Delivering to">
          <DetailRow label="Name" value={order.customerName} />
          <DetailRow label="Phone" value={order.phone} selectable />
          <DetailRow label="Address" value={order.deliveryAddress} selectable />
          <DetailRow label="City" value={order.deliveryCity} />
          {order.deliveryNotes ? (
            <DetailRow label="Notes" value={order.deliveryNotes} />
          ) : null}
        </Card>

        <Text style={styles.note}>
          No card details were collected. We will confirm the order and take payment directly with
          you.
        </Text>

        <Button
          label="Back to shop"
          onPress={() => navigation.navigate('Tabs', { screen: 'Shop' })}
        />
      </ScrollView>
    </Screen>
  );
}

function Row({ label: text, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{text}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  hero: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
  },
  title: {
    fontFamily: fontDisplay,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    textAlign: 'center',
  },
  orderNumber: {
    fontFamily: fontDisplay,
    fontSize: 26,
    letterSpacing: 1.5,
    color: colors.accent,
    textAlign: 'center',
    paddingVertical: space.sm,
  },
  hint: {
    ...type.meta,
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  lineText: {
    flex: 1,
    gap: 2,
  },
  lineName: {
    ...type.title,
  },
  lineMeta: {
    ...type.meta,
  },
  lineTotal: {
    ...type.price,
    fontSize: 15,
    lineHeight: 21,
  },
  rule: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    ...type.body,
  },
  rowValue: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
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
  note: {
    ...type.meta,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: space.md,
    ...shadow.card,
  },
});