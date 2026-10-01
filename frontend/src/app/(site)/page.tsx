import Link from 'next/link';
import { ArrowRightIcon, AwardIcon, LeafIcon, TruckIcon } from '@/components/Icons';
import { ProductCard } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { fetchCategories, fetchProducts } from '@/lib/api-server';

/**
 * Homepage — the layout from design/homepage.png.
 *
 * A server component: the catalogue is fetched on the server and rendered into
 * the HTML, so the page is indexable and paints with content already present.
 * Only the add-to-cart controls and the cart badge hydrate on the client.
 */

// Catalogue freshness: one minute. The API stays the source of truth for prices.
export const revalidate = 60;

const TRUST_POINTS = [
  {
    Icon: LeafIcon,
    title: 'Baked fresh daily',
    body: 'Every cake is made to order in our own kitchen — never frozen, never pre-made.',
  },
  {
    Icon: TruckIcon,
    title: 'Delivery & setup',
    body: 'Same-day delivery across Lagos, with setup available for larger events.',
  },
  {
    Icon: AwardIcon,
    title: 'Professional grade',
    body: 'The equipment and supplies we stock are the ones our own team cooks with.',
  },
];

export default async function HomePage() {
  const [categories, featured] = await Promise.all([
    fetchCategories(),
    fetchProducts({ featured: true, limit: 4 }),
  ]);

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero__inner">
            <div>
              <p className="eyebrow">Fresh · Delicious · Memorable</p>
              <h1 className="hero__title">Cakes &amp; Catering Equipment for Every Occasion</h1>
              <p className="hero__lead">
                From hand-finished celebration cakes to the chafing dishes, mixers and event
                essentials that keep a professional kitchen running — all in one place, delivered to
                your door.
              </p>
              <div className="hero__actions">
                <Link href="/category/cakes" className="btn">
                  Shop Cakes
                </Link>
                <Link href="/category/catering-equipment" className="btn btn--outline">
                  Explore Catering Equipment
                </Link>
              </div>
            </div>

            <div className="hero__media">
              <ProductImage
                src="/images/catalog/hero-cake.jpg"
                alt="A four-tier white celebration cake finished with orchids"
                className="hero__image"
                sizes="(max-width: 900px) 100vw, 50vw"
                priority
              />
            </div>
          </div>

          {/* ------------------------------------------------- Trust bullets */}
          <ul className="trust">
            {TRUST_POINTS.map(({ Icon, title, body }) => (
              <li className="trust__item" key={title}>
                <span className="trust__icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div>
                  <h2 className="trust__title">{title}</h2>
                  <p className="trust__body">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------ Shop by category */}
      <section className="section section--cream">
        <div className="container">
          <header className="section__header">
            <div>
              <p className="eyebrow">Shop by category</p>
              <h2 className="section__title">Find exactly what you need</h2>
            </div>
            <Link href="/search" className="btn btn--ghost">
              Browse everything <ArrowRightIcon size={16} />
            </Link>
          </header>

          {categories.length === 0 ? (
            <p className="muted">
              Our catalogue is unavailable right now. Please check back in a moment.
            </p>
          ) : (
            <ul className="grid grid--4">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link href={`/category/${category.slug}`} className="category-card">
                    <ProductImage
                      src={category.imageUrl}
                      alt=""
                      className="category-card__image"
                      sizes="(max-width: 720px) 100vw, (max-width: 1080px) 50vw, 25vw"
                    />
                    <span className="category-card__veil" aria-hidden="true" />
                    <span className="category-card__body">
                      <span className="category-card__name">{category.name}</span>
                      <span className="category-card__count">
                        {category.productCount} {category.productCount === 1 ? 'item' : 'items'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* --------------------------------------------------- Featured products */}
      <section className="section">
        <div className="container">
          <header className="section__header">
            <div>
              <p className="eyebrow">Featured products</p>
              <h2 className="section__title">Loved by our customers</h2>
            </div>
            <Link href="/search?sort=newest" className="btn btn--ghost">
              See all products <ArrowRightIcon size={16} />
            </Link>
          </header>

          {featured.data.length === 0 ? (
            <p className="muted">Nothing is featured just yet. Try browsing a category above.</p>
          ) : (
            <ul className="grid grid--4">
              {featured.data.map((product, index) => (
                <li key={product.id}>
                  <ProductCard product={product} priority={index === 0} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA band */}
      <section className="cta">
        <ProductImage
          src="/images/catalog/cta-cake.jpg"
          alt=""
          className="cta__image"
          sizes="100vw"
        />
        <div className="container cta__inner">
          <div>
            <h2 className="cta__title">Planning something special?</h2>
            <p className="cta__lead">
              Tell us the date, the headcount and the mood. We will handle the food, the equipment
              and the setup so you can enjoy your own event.
            </p>
          </div>
          <Link href="/contact" className="btn btn--light">
            Talk to our team
          </Link>
        </div>
      </section>
    </>
  );
}
