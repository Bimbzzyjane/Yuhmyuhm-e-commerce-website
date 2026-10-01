import { API_BASE_URL, buildProductQuery, type ProductQueryParams } from './api';
import type { CategoryWithCount, Paginated, Product } from './types';

/**
 * Server-side catalogue fetching for React Server Components.
 *
 * Going through the server (rather than fetching in the browser) means the
 * catalogue is in the first paint and indexable — which is the whole reason
 * these pages are server components.
 *
 * Failures degrade to empty results instead of a 500: a shopper should see a
 * working shell with a friendly message, not a crash, if the API blips.
 */

const REVALIDATE_SECONDS = 60;

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate },
    });
    if (!response.ok) {
      console.error(`[api-server] ${path} responded ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[api-server] ${path} failed:`, error);
    return null;
  }
}

export async function fetchCategories(): Promise<CategoryWithCount[]> {
  const payload = await getJson<{ data: CategoryWithCount[] }>(
    '/api/categories',
    REVALIDATE_SECONDS,
  );
  return payload?.data ?? [];
}

export async function fetchProducts(params: ProductQueryParams = {}): Promise<Paginated<Product>> {
  const payload = await getJson<Paginated<Product>>(
    `/api/products${buildProductQuery(params)}`,
    REVALIDATE_SECONDS,
  );

  return (
    payload ?? {
      data: [],
      pagination: {
        total: 0,
        limit: params.limit ?? 12,
        offset: params.offset ?? 0,
        hasMore: false,
      },
    }
  );
}

export async function fetchProduct(idOrSlug: string): Promise<Product | null> {
  const payload = await getJson<{ data: Product }>(
    `/api/products/${encodeURIComponent(idOrSlug)}`,
    REVALIDATE_SECONDS,
  );
  return payload?.data ?? null;
}

export async function fetchCategory(slug: string): Promise<CategoryWithCount | null> {
  const payload = await getJson<{ data: CategoryWithCount }>(
    `/api/categories/${encodeURIComponent(slug)}`,
    REVALIDATE_SECONDS,
  );
  return payload?.data ?? null;
}
