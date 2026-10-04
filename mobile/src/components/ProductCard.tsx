import { StyleSheet, Text, View } from 'react-native';
import type { Product } from '../lib/types';
import { colors, radius, shadow, space } from '../theme/colors';
import { type } from '../theme/typography';
import { Button } from './Button';
import { ProductThumb } from './ProductThumb';

export interface ProductCardProps {
  product: Product;
  onAdd: () => void;
  busy?: boolean;
  /** Briefly true after a successful add, for a quiet confirmation. */
  added?: boolean;
}

/** Matches the website's low-stock threshold. */
const LOW_STOCK_THRESHOLD = 5;

/**
 * Catalogue card, restructured to mirror the website's `.product-card`:
 * a square media block on top (cream-backed, cover, badge overlaid), then the
 * category eyebrow, the title, the price with its stock note, and a full-width
 * action.
 *
 * The price is `priceLabel` exactly as the API rendered it — the app never
 * formats money.
 */
export function ProductCard({ product, onAdd, busy = false, added = false }: ProductCardProps) {
  const soldOut = !product.inStock;
  const lowStock = !soldOut && product.stockQuantity <= LOW_STOCK_THRESHOLD;

  return (
    <View style={styles.card}>
      <View style={styles.media}>
        <ProductThumb uri={product.imageUrl} name={product.name} style={styles.mediaImage} />

        {product.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {product.category ? <Text style={styles.category}>{product.category.name}</Text> : null}

        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.meta}>
          <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>
            {product.priceLabel}
          </Text>
          {soldOut ? (
            <Text style={styles.stock}>Out of stock</Text>
          ) : lowStock ? (
            <Text style={styles.stock}>Only {product.stockQuantity} left</Text>
          ) : null}
        </View>

        <Button
          label={added ? 'Added' : 'Add to cart'}
          size="sm"
          busy={busy}
          disabled={soldOut}
          onPress={onAdd}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  media: {
    width: '100%',
    aspectRatio: 1, // the website's 1 / 1 media block
    backgroundColor: colors.cream,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0, // the card clips the corners, not the image
  },
  badge: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  body: {
    padding: space.md,
    gap: space.xs,
  },
  category: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  name: {
    ...type.title,
    fontSize: 14,
    lineHeight: 19,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
    marginTop: space.xs,
  },
  price: {
    ...type.price,
    flexShrink: 1,
  },
  stock: {
    ...type.meta,
    color: colors.danger,
    fontWeight: '600',
  },
  action: {
    marginTop: space.sm,
  },
});
