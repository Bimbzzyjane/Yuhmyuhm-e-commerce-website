import Link from 'next/link';
import type { Product, ProductBadge } from '@/lib/types';
import { AddToCartButton } from './AddToCartButton';
import { HeartIcon } from './Icons';
import { ProductImage } from './ProductImage';

/**
 * Catalogue card — the "Featured Products" tile from the design.
 *
 * Rendered on the server (only the add-to-cart control is interactive), so the
 * catalogue is fully present in the initial HTML for SEO and first paint.
 */

const BADGE_CLASS: Record<ProductBadge, string> = {
  'Best Seller': 'badge badge--olive',
  New: 'badge',
  Limited: 'badge badge--ink',
};

const LOW_STOCK_THRESHOLD = 5;

export interface ProductCardProps {
  product: Product;
  /** Set on the first row of a page so the hero images load eagerly. */
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const href = `/products/${product.slug}`;
  const lowStock = product.inStock && product.stockQuantity <= LOW_STOCK_THRESHOLD;

  return (
    <article className="product-card">
      <Link href={href} className="product-card__media" aria-label={`View ${product.name}`}>
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="product-card__image"
          priority={priority}
          sizes="(max-width: 720px) 100vw, (max-width: 1080px) 50vw, 25vw"
        />
        {product.badge ? (
          <span className={`product-card__badge ${BADGE_CLASS[product.badge]}`}>
            {product.badge}
          </span>
        ) : null}
        {/* Decorative only — wishlists are not a feature yet, so this must not
            pretend to be a working control. */}
        <span className="product-card__wish" aria-hidden="true">
          <HeartIcon size={17} />
        </span>
      </Link>

      <div className="product-card__body">
        {product.category ? (
          <span className="product-card__category">{product.category.name}</span>
        ) : null}

        <h3 className="product-card__title">
          <Link href={href}>{product.name}</Link>
        </h3>

        <div className="product-card__meta">
          <span className="product-card__price">{product.priceLabel}</span>
          {!product.inStock ? (
            <span className="product-card__stock product-card__stock--low">Out of stock</span>
          ) : lowStock ? (
            <span className="product-card__stock product-card__stock--low">
              Only {product.stockQuantity} left
            </span>
          ) : null}
        </div>

        <div className="product-card__action">
          <AddToCartButton productId={product.id} disabled={!product.inStock} />
        </div>
      </div>
    </article>
  );
}
