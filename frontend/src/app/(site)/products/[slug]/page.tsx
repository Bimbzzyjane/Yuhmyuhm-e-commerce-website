import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductImage } from '@/components/ProductImage';
import { ProductPurchasePanel } from '@/components/ProductPurchasePanel';
import { fetchProduct, fetchProducts } from '@/lib/api-server';

/**
 * Product detail.
 *
 * Server-rendered, with `Product` JSON-LD so search engines can surface the
 * price and availability.
 */

export const revalidate = 60;

const MAX_PER_ORDER = 20;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) return { title: 'Product not found' };

  return {
    title: product.name,
    description:
      product.description ??
      `${product.name} from Yuhmyuhm Catering Services — ${product.priceLabel}.`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) notFound();

  const related = product.category
    ? await fetchProducts({ category: product.category.slug, limit: 5 })
    : { data: [], pagination: { total: 0, limit: 5, offset: 0, hasMore: false } };

  const alsoLike = related.data.filter((item) => item.id !== product.id).slice(0, 4);

  // Structured data. schema.org wants major units, the API speaks kobo.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    image: product.imageUrl ?? undefined,
    category: product.category?.name,
    offers: {
      '@type': 'Offer',
      price: (product.price / 100).toFixed(2),
      priceCurrency: 'NGN',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised from API values; escaping guards against a `</script>`
        // sequence appearing inside a product name or description.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <div className="page-head">
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="breadcrumb__sep" aria-hidden="true">
              /
            </span>
            {product.category ? (
              <>
                <Link href={`/category/${product.category.slug}`}>{product.category.name}</Link>
                <span className="breadcrumb__sep" aria-hidden="true">
                  /
                </span>
              </>
            ) : null}
            <span>{product.name}</span>
          </nav>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="product-detail">
            <div className="product-detail__media">
              <ProductImage
                src={product.imageUrl}
                alt={product.name}
                className="product-detail__image"
                sizes="(max-width: 880px) 100vw, 50vw"
                priority
              />
            </div>

            <div>
              {product.badge ? <span className="badge badge--olive">{product.badge}</span> : null}

              <h1 className="page-head__title product-detail__heading">{product.name}</h1>

              <p className="product-detail__price">{product.priceLabel}</p>

              {product.description ? (
                <p className="product-detail__description">{product.description}</p>
              ) : null}

              <ProductPurchasePanel
                productId={product.id}
                productName={product.name}
                maxQuantity={Math.min(product.stockQuantity, MAX_PER_ORDER)}
                outOfStock={!product.inStock}
              />

              <div className="product-detail__facts">
                <p>
                  <strong>Availability: </strong>
                  {product.inStock ? `${product.stockQuantity} in stock` : 'Currently out of stock'}
                </p>
                {product.category ? (
                  <p>
                    <strong>Category: </strong>
                    <Link href={`/category/${product.category.slug}`}>{product.category.name}</Link>
                  </p>
                ) : null}
                <p>
                  <strong>Delivery: </strong>
                  Same-day across Lagos, free on orders over ₦150,000.
                </p>
                <p className="muted">
                  Payment is arranged directly with our team after you place the order — we will
                  call you to confirm.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {alsoLike.length > 0 ? (
        <section className="section section--cream">
          <div className="container">
            <header className="section__header">
              <div>
                <p className="eyebrow">You may also like</p>
                <h2 className="section__title">More from {product.category?.name}</h2>
              </div>
              {product.category ? (
                <Link href={`/category/${product.category.slug}`} className="btn btn--ghost">
                  View collection
                </Link>
              ) : null}
            </header>
            <ProductGrid products={alsoLike} />
          </div>
        </section>
      ) : null}
    </>
  );
}
