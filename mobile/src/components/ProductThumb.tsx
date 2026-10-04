import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { resolveAssetUrl } from '../config/env';
import { colors, radius, space } from '../theme/colors';
import { fontDisplay } from '../theme/typography';
import { GoldRule } from './Brand';

export interface ProductThumbProps {
  /** As returned by the API: an absolute URL, a storefront-relative path, or null. */
  uri: string | null | undefined;
  /** Product name, used for the accessible label and the compact fallback. */
  name: string;
  /** Fixed square size. Omit when the parent sizes the box (the product card). */
  size?: number;
  /** Small cart-row tile: a terser fallback than the large product tile. */
  compact?: boolean;
  /** Applied to both the image and the fallback box, so they stay interchangeable. */
  style?: StyleProp<ViewStyle & ImageStyle>;
}

/**
 * Product image with an intentional, branded fallback.
 *
 * The catalogue returns storefront-relative paths such as
 * `/images/catalog/<slug>.jpg`, which are resolved by `resolveAssetUrl()` against
 * `EXPO_PUBLIC_STOREFRONT_URL` — nothing about the backend changes.
 *
 * The `<Image>` is only rendered when a usable absolute URL exists, so React
 * Native is never handed an empty or relative `uri` (which would fail silently).
 */
export function ProductThumb({ uri, name, size, compact = false, style }: ProductThumbProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveAssetUrl(uri);

  /*
   * List rows are recycled, so a previous product's failure would otherwise stick
   * to whichever product now occupies this cell. Reset whenever the target changes.
   */
  useEffect(() => {
    setFailed(false);
  }, [uri, resolved]);

  const box = size ? { width: size, height: size } : null;

  if (!resolved || failed) {
    return (
      <View style={[styles.placeholder, compact && styles.placeholderCompact, box, style]}>
        {compact ? (
          <Text numberOfLines={2} style={styles.placeholderName}>
            {name}
          </Text>
        ) : (
          <View style={styles.placeholderBrand}>
            <GoldRule width={space.xl} />
            <Text style={styles.placeholderWordmark}>Yuhmyuhm</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolved }}
      resizeMode="cover"
      accessibilityLabel={name}
      onError={() => {
        // A CDN/URL change should be readable in the device logs, not invisible.
        console.warn(`[ProductThumb] image failed to load: ${resolved}`);
        setFailed(true);
      }}
      style={[styles.image, box, style]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
  },
  placeholder: {
    backgroundColor: colors.creamDeep,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  placeholderCompact: {
    padding: 2,
  },
  placeholderBrand: {
    alignItems: 'center',
    gap: space.xs,
  },
  placeholderWordmark: {
    fontFamily: fontDisplay,
    fontSize: 13,
    color: colors.accentSoft,
  },
  placeholderName: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
    color: colors.inkFaint,
  },
});
