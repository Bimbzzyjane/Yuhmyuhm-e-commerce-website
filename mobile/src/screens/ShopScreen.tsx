import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Eyebrow, ScreenBrand } from '../components/Brand';
import { StateView } from '../components/Card';
import { ProductCard } from '../components/ProductCard';
import { Screen } from '../components/Screen';
import { useCart } from '../context/CartProvider';
import { api, apiErrorMessage } from '../lib/api';
import { isStorefrontConfigured } from '../config/env';
import type { Product } from '../lib/types';
import type { TabScreenProps } from '../navigation/types';
import { colors, space } from '../theme/colors';
import { type } from '../theme/typography';

/**
 * Shop tab — the public catalogue.
 *
 * Reads `GET /api/products` and renders a two-up grid of vertical cards, which is
 * the mobile equivalent of the website's four-up grid. Two columns is chosen so
 * cards stay a comfortable width (~160pt on a 360pt phone) rather than becoming
 * narrow strips.
 *
 * Guests browse and fill a guest cart exactly the same way.
 */
export function ShopScreen(_props: TabScreenProps<'Shop'>) {
  const { addItem, error: cartError } = useCart();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);

    try {
      const page = await api.products({ limit: 24, offset: 0, sort: 'featured' });
      setProducts(page.data);
      setTotal(page.pagination.total);
      setError(null);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'We could not load the catalogue.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  // Clear the transient "Added" confirmation after a moment.
  useEffect(() => {
    if (!addedId) return;
    const timer = setTimeout(() => setAddedId(null), 1500);
    return () => clearTimeout(timer);
  }, [addedId]);

  const handleAdd = useCallback(
    async (product: Product) => {
      setPendingId(product.id);
      const result = await addItem(product.id, 1);
      setPendingId(null);
      if (result.ok) setAddedId(product.id);
    },
    [addItem],
  );

  if (loading) {
    return (
      <Screen>
        <StateView busy title="Loading the catalogue…" />
      </Screen>
    );
  }

  if (error && !products) {
    return (
      <Screen>
        <StateView
          tone="error"
          title="We could not load the catalogue"
          message={error}
          actionLabel="Retry"
          onAction={() => void load('initial')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={products ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            busy={pendingId === item.id}
            added={addedId === item.id}
            onAdd={() => void handleAdd(item)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenBrand />

            <Eyebrow trailing={<Text style={styles.count}>{total ?? 0} items</Text>}>
              Featured
            </Eyebrow>

            <Text style={styles.intro}>
              Premium cakes, hand-finished in our kitchen, and professional catering equipment.
            </Text>

            {/* Misconfiguration should be visible, not a silent blank grid. */}
            {!isStorefrontConfigured ? (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>Catalogue photos unavailable</Text>
                <Text style={styles.noticeBody}>
                  This build has no storefront URL configured, so product images cannot be
                  loaded. Everything else works normally.
                </Text>
              </View>
            ) : null}

            {cartError ? <Text style={styles.errorBanner}>{cartError}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <StateView
            title="No products yet"
            message="The catalogue is empty right now. Pull down to try again."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
  column: {
    gap: space.md,
    marginBottom: space.md,
  },
  header: {
    gap: space.sm,
    marginBottom: space.lg,
  },
  intro: {
    ...type.bodySmall,
  },
  count: {
    ...type.eyebrow,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  notice: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accentSoft,
    backgroundColor: colors.cream,
    borderRadius: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: 2,
  },
  noticeTitle: {
    ...type.inputLabel,
    color: colors.inkSoft,
  },
  noticeBody: {
    ...type.meta,
    color: colors.inkSoft,
  },
  errorBanner: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
    borderRadius: 6,
    padding: space.md,
    fontSize: 13,
    lineHeight: 18,
  },
});
