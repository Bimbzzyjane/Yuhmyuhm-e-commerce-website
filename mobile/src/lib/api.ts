import { ENV, apiUrlIssue } from '../config/env';
import type { Cart, Paginated, Product, UserProfile } from './types';

/**
 * Typed API client for the EXISTING Yuhmyuhm Express API.
 *
 * This mirrors the website's `frontend/src/lib/api.ts` so the two clients behave
 * identically:
 *  - the caller passes the Supabase access token in explicitly (no hidden
 *    session state), so there are no stale-token bugs;
 *  - identity is sent as `Authorization: Bearer <token>` when signed in, or as
 *    `X-Guest-Cart-Id: <uuid>` when anonymous — never both;
 *  - every failure is normalised into the API's single error envelope.
 *
 * No new routes are invented here. Endpoint helpers are added alongside `health`
 * in the next phase (products, cart, auth/me, orders).
 */

/** The one error shape the API ever returns (`backend/src/middleware/error.ts`). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

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

  /** True when the request never reached the API (offline / wrong base URL). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Supabase access token, when the user is signed in. */
  accessToken?: string | null;
  /** Guest cart id, when there is no signed-in user. */
  guestCartId?: string | null;
  signal?: AbortSignal;
}

/**
 * Builds an absolute request URL against the configured base.
 *
 * `ENV.apiUrl` is already normalised (trimmed, no trailing slash), so this works
 * whether the deployed HTTPS origin was configured as
 * `https://api.example.com` or `https://api.example.com/`. The path always
 * starts with exactly one `/`.
 *
 * Throws a readable `ApiError` rather than letting `fetch` fail obscurely when
 * the base URL is missing or malformed.
 */
export function apiUrl(path: string): string {
  const issue = apiUrlIssue();
  if (issue) {
    throw new ApiError(issue, { status: 0, code: 'API_NOT_CONFIGURED' });
  }
  return `${ENV.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  // A bearer token wins; the guest header is only used when anonymous. Sending
  // both would be ambiguous, and the API deliberately derives identity from one.
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  else if (options.guestCartId) headers['X-Guest-Cart-Id'] = options.guestCartId;

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (caught) {
    // A configuration error / abort must not be masked as a network failure.
    if (caught instanceof ApiError) throw caught;
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
 * can put each message next to the field that caused it. Mirrors the website.
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
// Credentials + endpoint helpers
// ---------------------------------------------------------------------------

/** What a cart-aware request needs: a token, or a guest cart id — never both. */
export interface CartCredentials {
  accessToken?: string | null;
  guestCartId?: string | null;
  signal?: AbortSignal;
}

/** `GET /api/health` — public liveness probe (not wrapped in `{ data }`). */
export interface HealthResponse {
  status: string;
  service: string;
  uptimeSeconds: number;
}

export type ProductSort = 'featured' | 'price-asc' | 'price-desc' | 'newest';

export interface ProductQueryParams {
  category?: string;
  search?: string;
  featured?: boolean;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

export function buildProductQuery(params: ProductQueryParams): string {
  const parts: string[] = [];
  if (params.category) parts.push(`category=${encodeURIComponent(params.category)}`);
  if (params.search) parts.push(`search=${encodeURIComponent(params.search)}`);
  if (params.featured !== undefined) parts.push(`featured=${String(params.featured)}`);
  if (params.sort) parts.push(`sort=${params.sort}`);
  if (params.limit !== undefined) parts.push(`limit=${String(params.limit)}`);
  if (params.offset !== undefined) parts.push(`offset=${String(params.offset)}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** A readable message from anything thrown, for user-facing surfaces. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Every cart endpoint returns the FULL cart DTO, so the client adopts what came
 * back instead of guessing what changed. These helpers unwrap the `{ data }`
 * envelope; the caller never sees it.
 */
export const api = {
  /**
   * Liveness only: `{ status, service, uptimeSeconds }`.
   *
   * Deliberately the smallest possible call — no auth, no database. Used by the
   * diagnostics screen to prove the app can reach the existing Express API.
   */
  health: (signal?: AbortSignal) => apiRequest<HealthResponse>('/api/health', { signal }),

  /** `GET /api/products` → `{ data, pagination }` (already unwrapped). */
  products: (params: ProductQueryParams = {}, signal?: AbortSignal) =>
    apiRequest<Paginated<Product>>(`/api/products${buildProductQuery(params)}`, { signal }),

  /** `GET /api/products/:idOrSlug` — accepts either form. */
  product: (idOrSlug: string, signal?: AbortSignal) =>
    apiRequest<{ data: Product }>(`/api/products/${encodeURIComponent(idOrSlug)}`, { signal }).then(
      (response) => response.data,
    ),

  /**
   * `GET /api/auth/me` — the API's profile row for this token.
   *
   * Also creates the profile on first sight, so calling it after sign-in is how
   * we learn whether the API recognises the account.
   */
  me: (accessToken: string, signal?: AbortSignal) =>
    apiRequest<{ data: UserProfile }>('/api/auth/me', { accessToken, signal }).then(
      (response) => response.data,
    ),

  /** `GET /api/cart` */
  getCart: (credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>('/api/cart', credentials).then((response) => response.data),

  /** `POST /api/cart/items` — `productId` must be the product's UUID. */
  addCartItem: (productId: string, quantity: number, credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>('/api/cart/items', {
      method: 'POST',
      body: { productId, quantity },
      ...credentials,
    }).then((response) => response.data),

  /** `PATCH /api/cart/items/:itemId` — `quantity: 0` removes the line. */
  updateCartItem: (itemId: string, quantity: number, credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>(`/api/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      body: { quantity },
      ...credentials,
    }).then((response) => response.data),

  /** `DELETE /api/cart/items/:itemId` */
  removeCartItem: (itemId: string, credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>(`/api/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      ...credentials,
    }).then((response) => response.data),

  /** `DELETE /api/cart` — empties the cart. */
  clearCart: (credentials: CartCredentials) =>
    apiRequest<{ data: Cart }>('/api/cart', {
      method: 'DELETE',
      ...credentials,
    }).then((response) => response.data),

  /**
   * `POST /api/cart/merge` — folds a guest cart into the signed-in account.
   *
   * Requires the Bearer token (merging is always *into* an account). The
   * backend SUMS quantities into the existing account cart, so this can never
   * clobber what the account already had.
   */
  mergeCart: (guestCartId: string, accessToken: string) =>
    apiRequest<{ data: Cart }>('/api/cart/merge', {
      method: 'POST',
      body: { guestCartId },
      accessToken,
    }).then((response) => response.data),
};
