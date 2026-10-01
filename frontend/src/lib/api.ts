import type {
  ApiErrorBody,
  Cart,
  CategoryWithCount,
  CheckoutPayload,
  Order,
  Paginated,
  Product,
  UserProfile,
} from './types';

/**
 * Browser-side API client.
 *
 * Two things to note:
 *  1. The access token is passed in explicitly rather than read from a module
 *     global, so there is no hidden session state and no stale-token bugs.
 *  2. The guest cart id lives in localStorage under one key. It is the ONLY
 *     thing the client is trusted with — the server still decides what that
 *     cart contains.
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '');

const GUEST_CART_KEY = 'yuhmyuhm.guestCartId';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    options: { status: number; code: string; details?: unknown; requestId?: string },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
  }

  /** True when the caller's session is no longer usable. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

// ---------------------------------------------------------------------------
// Guest cart id storage
// ---------------------------------------------------------------------------

export function getGuestCartId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(GUEST_CART_KEY);
  } catch {
    // Private browsing / storage disabled: fall back to an anonymous session.
    return null;
  }
}

export function setGuestCartId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_CART_KEY, id);
  } catch {
    /* non-fatal */
  }
}

export function clearGuestCartId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    /* non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
  /** Sent as X-Guest-Cart-Id when there is no signed-in user. */
  guestCartId?: string | null;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  else if (options.guestCartId) headers['X-Guest-Cart-Id'] = options.guestCartId;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: 'no-store',
    });
  } catch {
    // Network-level failure: the API is unreachable, not rejecting the request.
    throw new ApiError('We could not reach the shop. Please check your connection.', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const body = payload as ApiErrorBody | null;
    throw new ApiError(body?.error?.message ?? 'Something went wrong. Please try again.', {
      status: response.status,
      code: body?.error?.code ?? 'INTERNAL_ERROR',
      details: body?.error?.details,
      requestId: body?.error?.requestId,
    });
  }

  return payload as T;
}

/**
 * Turns a VALIDATION_ERROR payload into `{ "customer.email": "..." }` so a form
 * can put each message next to the field that caused it.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const details = error.details as { issues?: Array<{ path?: string; message?: string }> } | null;
  const issues = details?.issues;
  if (!Array.isArray(issues)) return {};

  const result: Record<string, string> = {};
  for (const issue of issues) {
    if (issue?.path) result[issue.path] = issue.message ?? 'This value is not valid.';
  }
  return result;
}

// ---------------------------------------------------------------------------
// Endpoint helpers
// ---------------------------------------------------------------------------

export interface ProductQueryParams {
  category?: string;
  search?: string;
  featured?: boolean;
  sort?: 'featured' | 'price-asc' | 'price-desc' | 'newest';
  limit?: number;
  offset?: number;
}

export function buildProductQuery(params: ProductQueryParams): string {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.search) search.set('search', params.search);
  if (params.featured !== undefined) search.set('featured', String(params.featured));
  if (params.sort) search.set('sort', params.sort);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.offset !== undefined) search.set('offset', String(params.offset));
  const query = search.toString();
  return query ? `?${query}` : '';
}

interface CartCredentials {
  accessToken?: string | null;
  guestCartId?: string | null;
  signal?: AbortSignal;
}

export const api = {
  categories: (signal?: AbortSignal) =>
    apiRequest<{ data: CategoryWithCount[] }>('/api/categories', { signal }),

  products: (params: ProductQueryParams = {}, signal?: AbortSignal) =>
    apiRequest<Paginated<Product>>(`/api/products${buildProductQuery(params)}`, { signal }),

  product: (idOrSlug: string, signal?: AbortSignal) =>
    apiRequest<{ data: Product }>(`/api/products/${encodeURIComponent(idOrSlug)}`, { signal }),

  me: (accessToken: string, signal?: AbortSignal) =>
    apiRequest<{ data: UserProfile }>('/api/auth/me', { accessToken, signal }),

  getCart: (credentials: CartCredentials) => apiRequest<{ data: Cart }>('/api/cart', credentials),

  addCartItem: (productId: string, quantity: number, credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>('/api/cart/items', {
      method: 'POST',
      body: { productId, quantity },
      ...credentials,
    }),

  updateCartItem: (itemId: string, quantity: number, credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>(`/api/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      body: { quantity },
      ...credentials,
    }),

  removeCartItem: (itemId: string, credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>(`/api/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      ...credentials,
    }),

  clearCart: (credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>('/api/cart', { method: 'DELETE', ...credentials }),

  mergeCart: (guestCartId: string, accessToken: string) =>
    apiRequest<{ data: Cart }>('/api/cart/merge', {
      method: 'POST',
      body: { guestCartId },
      accessToken,
    }),

  placeOrder: (payload: CheckoutPayload, credentials: CartCredentials) =>
    apiRequest<{ data: Order }>('/api/orders', {
      method: 'POST',
      body: payload,
      ...credentials,
    }),

  orders: (accessToken: string, signal?: AbortSignal) =>
    apiRequest<{ data: Order[] }>('/api/orders', { accessToken, signal }),

  order: (orderId: string, accessToken: string, signal?: AbortSignal) =>
    apiRequest<{ data: Order }>(`/api/orders/${encodeURIComponent(orderId)}`, {
      accessToken,
      signal,
    }),
};
