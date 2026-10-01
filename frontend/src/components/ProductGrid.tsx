import Link from 'next/link';
import { PackageIcon } from './Icons';
import { ProductCard } from './ProductCard';
import type { Product } from '@/lib/types';

/**
 * Shared product grid.
 *
 * Used by the category, search and "all products" views so the layout and the
 * empty state are defined exactly once.
 */
export interface ProductGridProps {
  products: Product[];
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: { href: string; label: string };
}

export function ProductGrid({
  products,
  emptyTitle = 'Nothing here yet',
  emptyBody = 'Try another category, or browse the full catalogue.',
  emptyAction = { href: '/search', label: 'Browse all products' },
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="empty">
        <span className="empty__icon" aria-hidden="true">
          <PackageIcon size={28} />
        </span>
        <h2 className="empty__title">{emptyTitle}</h2>
        <p className="empty__body">{emptyBody}</p>
        <Link href={emptyAction.href} className="btn btn--outline">
          {emptyAction.label}
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid--4">
      {products.map((product, index) => (
        <li key={product.id}>
          {/* The first row is above the fold, so it loads eagerly. */}
          <ProductCard product={product} priority={index < 4} />
        </li>
      ))}
    </ul>
  );
}
