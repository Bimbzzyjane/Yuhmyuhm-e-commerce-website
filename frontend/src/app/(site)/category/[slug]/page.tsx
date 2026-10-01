import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/ProductGrid';
import { fetchCategory, fetchProducts } from '@/lib/api-server';
import type { ProductQueryParams } from '@/lib/api';

/**
 * Category listing — the "Shop by Category" destination.
 *
 * Sorting and paging are plain links (`?sort=…&page=…`), so the whole view is
 * server-rendered, shareable and works without JavaScript.
 */

export const revalidate = 60;

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest first' },
] as const;

type SortValue = ProductQueryParams['sort'];

function parseSort(value: string | undefined): SortValue {
  return SORT_OPTIONS.some((option) => option.value === value) ? (value as SortValue) : 'featured';
}

function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategory(slug);

  if (!category) return { title: 'Collection not found' };

  return {
    title: category.name,
    description:
      category.description ??
      `Shop ${category.name.toLowerCase()} from Yuhmyuhm Catering Services.`,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const category = await fetchCategory(slug);
  if (!category) notFound();

  const page = parsePage(query.page);
  const sort = parseSort(query.sort);
  const offset = (page - 1) * PAGE_SIZE;

  const products = await fetchProducts({
    category: slug,
    sort,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(products.pagination.total / PAGE_SIZE));

  const hrefFor = (next: { sort?: SortValue; page?: number }): string => {
    const search = new URLSearchParams();
    const nextSort = next.sort ?? sort;
    const nextPage = next.page ?? page;
    if (nextSort && nextSort !== 'featured') search.set('sort', nextSort);
    if (nextPage > 1) search.set('page', String(nextPage));
    const suffix = search.toString();
    return `/category/${slug}${suffix ? `?${suffix}` : ''}`;
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
            <span>{category.name}</span>
          </nav>
          <h1 className="page-head__title">{category.name}</h1>
          {category.description ? <p className="page-head__lead">{category.description}</p> : null}
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
              {/* Links rather than a select: no JS, and every state is a URL. */}
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
            emptyTitle="No products in this collection"
            emptyBody="This collection is empty right now. Browse the full catalogue instead."
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
