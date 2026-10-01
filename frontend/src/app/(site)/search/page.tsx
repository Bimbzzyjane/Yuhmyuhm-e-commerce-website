import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/ProductGrid';
import { fetchProducts } from '@/lib/api-server';
import type { ProductQueryParams } from '@/lib/api';

/**
 * Search and "browse everything".
 *
 * `/search` with no query doubles as the full catalogue and as the paginated
 * listing behind the homepage's "See all products" link.
 */

export const revalidate = 60;

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
] as const;

type SortValue = ProductQueryParams['sort'];

function parseSort(value: string | undefined): SortValue {
  return SORT_OPTIONS.some((option) => option.value === value) ? (value as SortValue) : 'featured';
}

function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const term = q?.trim();

  return {
    title: term ? `Search: ${term}` : 'All products',
    description: term
      ? `Products matching “${term}” from Yuhmyuhm Catering Services.`
      : 'Browse the full Yuhmyuhm Catering Services catalogue of cakes and catering equipment.',
    // Search result pages should not be indexed as landing pages.
    robots: { index: !term, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = await searchParams;
  const term = query.q?.trim() ?? '';
  const sort = parseSort(query.sort);
  const page = parsePage(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const products = await fetchProducts({
    search: term || undefined,
    sort,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(products.pagination.total / PAGE_SIZE));

  const hrefFor = (next: { sort?: SortValue; page?: number }): string => {
    const search = new URLSearchParams();
    if (term) search.set('q', term);
    const nextSort = next.sort ?? sort;
    const nextPage = next.page ?? page;
    if (nextSort && nextSort !== 'featured') search.set('sort', nextSort);
    if (nextPage > 1) search.set('page', String(nextPage));
    const suffix = search.toString();
    return `/search${suffix ? `?${suffix}` : ''}`;
  };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="breadcrumb__sep" aria-hidden="true">
              /
            </span>
            <span>{term ? 'Search' : 'All products'}</span>
          </nav>

          <h1 className="page-head__title">
            {term ? `Results for “${term}”` : 'The full catalogue'}
          </h1>

          <form role="search" action="/search" method="get" className="header__searchform">
            <label htmlFor="search-page-input" className="sr-only">
              Search products
            </label>
            <input
              id="search-page-input"
              className="input"
              type="search"
              name="q"
              defaultValue={term}
              placeholder="Search for cakes, equipment or supplies…"
            />
            <button type="submit" className="btn">
              Search
            </button>
          </form>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="toolbar">
            <p className="toolbar__count">
              {products.pagination.total} {products.pagination.total === 1 ? 'product' : 'products'}
              {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
            </p>

            <div className="toolbar__controls">
              {SORT_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={hrefFor({ sort: option.value, page: 1 })}
                  className={option.value === sort ? 'pill badge--ink' : 'pill'}
                  aria-current={option.value === sort ? 'true' : undefined}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          <ProductGrid
            products={products.data}
            emptyTitle={term ? `No results for “${term}”` : 'The catalogue is empty'}
            emptyBody={
              term
                ? 'Check the spelling, or try a broader term such as “cake” or “chafing dish”.'
                : 'Please check back shortly.'
            }
            emptyAction={{ href: '/search', label: 'Clear search' }}
          />

          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Pagination">
              {page > 1 ? (
                <Link href={hrefFor({ page: page - 1 })} className="btn btn--outline btn--sm">
                  Previous
                </Link>
              ) : null}
              <span className="pagination__status">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={hrefFor({ page: page + 1 })} className="btn btn--outline btn--sm">
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
}
