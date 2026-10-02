import type {
  AuthenticatedIdentity,
  CartStatus,
  CategoryRef,
  OrderStatus,
  ProductBadge,
} from '../domain/types';

/**
 * Repository contracts.
 *
 * Two implementations satisfy these:
 *   - `repositories/supabase/*`  -> production, backed by Postgres.
 *   - `repositories/memory/*`    -> local demo + the entire automated suite.
 *
 * Keeping the app behind these interfaces is what lets the API boot and be
 * fully tested with no Supabase project, and it keeps SQL out of the services.
 *
 * NOTE ON MONEY: rows carry money as integer minor units (kobo). The Supabase
 * implementation converts `numeric(12,2)` <-> kobo at this boundary, so nothing
 * above this layer ever sees a decimal string.
 */

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewCategoryRow {
  slug: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string;
  /** Resolved category reference, so the API never needs a second query. */
  category: CategoryRef;
  /** Integer minor units (kobo). */
  price: number;
  imageUrl: string | null;
  badge: ProductBadge | null;
  isFeatured: boolean;
  isActive: boolean;
  stockQuantity: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewProductRow {
  slug: string;
  name: string;
  description?: string | null;
  /** Integer minor units (kobo). */
  price: number;
  categorySlug: string;
  imageUrl?: string | null;
  badge?: ProductBadge | null;
  isFeatured?: boolean;
  isActive?: boolean;
  stockQuantity?: number;
  sortOrder?: number;
}

export interface UserRow {
  id: string;
  authUserId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartRow {
  id: string;
  userId: string | null;
  guestToken: string | null;
  status: CartStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemRow {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRow {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNotes: string | null;
  /** Integer minor units (kobo). */
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NewOrderRow {
  userId: string | null;
  customerName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNotes?: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status?: OrderStatus;
}

export interface OrderItemRow {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  productImageUrl: string | null;
  /** Integer minor units (kobo), frozen at purchase time. */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface NewOrderItemRow {
  productId: string | null;
  productName: string;
  productSlug: string | null;
  productImageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

// ---------------------------------------------------------------------------
// Query objects
// ---------------------------------------------------------------------------

export interface ProductQuery {
  categorySlug?: string;
  search?: string;
  featured?: boolean;
  limit: number;
  offset: number;
  /** Storefront queries hide inactive products; admin tooling does not. */
  includeInactive?: boolean;
  /** Stable ordering: `sort_order`, then `name`. */
  orderBy?: 'sortOrder' | 'priceAsc' | 'priceDesc' | 'newest';
}

export interface Page<T> {
  rows: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export interface ProductRepository {
  list(query: ProductQuery): Promise<Page<ProductRow>>;
  findById(id: string): Promise<ProductRow | null>;
  /** Accepts either a UUID or a slug — used by `GET /api/products/:idOrSlug`. */
  findByIdOrSlug(value: string): Promise<ProductRow | null>;
  findManyByIds(ids: string[]): Promise<ProductRow[]>;
  /** Idempotent by `slug`; powers `npm run seed`. Returns the number written. */
  upsertMany(rows: NewProductRow[]): Promise<number>;
  /**
   * Removes `quantity` from stock as part of checkout.
   * Must throw OutOfStockError rather than allowing stock to go negative.
   */
  decrementStock(productId: string, quantity: number): Promise<void>;
}

export interface CategoryRepository {
  listWithCounts(options?: {
    activeOnly?: boolean;
  }): Promise<Array<CategoryRow & { productCount: number }>>;
  findBySlug(slug: string): Promise<CategoryRow | null>;
  upsertMany(rows: NewCategoryRow[]): Promise<number>;
}

export interface UserRepository {
  findByAuthUserId(authUserId: string): Promise<UserRow | null>;
  /**
   * Case-insensitive lookup by email. Used to re-link a profile when the same
   * person returns through a *different* sign-in method — for example signing
   * up with an email and password and later continuing with Google, which
   * gives them a different `auth.users` id but the same email address.
   */
  findByEmail(email: string): Promise<UserRow | null>;
  /** Creates the profile on first sign-in, refreshes name/avatar afterwards. */
  upsertFromIdentity(identity: AuthenticatedIdentity): Promise<UserRow>;
}

export interface CartRepository {
  findActiveByUserId(userId: string): Promise<CartRow | null>;
  findActiveByGuestToken(guestToken: string): Promise<CartRow | null>;
  findById(cartId: string): Promise<CartRow | null>;
  /** Creates an `active` cart owned by exactly one of `userId` / `guestToken`. */
  create(owner: { userId?: string | null; guestToken?: string | null }): Promise<CartRow>;
  listItems(cartId: string): Promise<CartItemRow[]>;
  /** Adds to the existing line for that product, or inserts a new one. */
  addItem(cartId: string, productId: string, quantity: number): Promise<CartItemRow>;
  /**
   * Writes `quantity` as the line's new absolute value, inserting the line when
   * it does not exist yet.
   *
   * Distinct from {@link addItem} on purpose: `addItem` needs a read first
   * because it increments in the service layer, which costs two round trips.
   * This is a single atomic statement, so the caller must have already read
   * the current quantity. It exists for the hot add-to-cart path, where a
   * latency-bound write is worth the trade.
   */
  upsertItem(cartId: string, productId: string, quantity: number): Promise<CartItemRow>;
  setItemQuantity(cartId: string, itemId: string, quantity: number): Promise<CartItemRow | null>;
  removeItem(cartId: string, itemId: string): Promise<boolean>;
  clearItems(cartId: string): Promise<number>;
  /** Moves every line of `sourceCartId` into `targetCartId`, summing quantities. */
  mergeInto(sourceCartId: string, targetCartId: string): Promise<void>;
  markStatus(cartId: string, status: CartStatus): Promise<void>;
  touch(cartId: string): Promise<void>;
}

export interface OrderRepository {
  /**
   * Inserts the order and its line items atomically.
   * `orderNumber` is assigned by the storage layer (Postgres default or the
   * memory counter) so concurrent checkouts can never collide.
   */
  create(input: { order: NewOrderRow; items: NewOrderItemRow[] }): Promise<{
    order: OrderRow;
    items: OrderItemRow[];
  }>;
  listByUserId(userId: string): Promise<Array<{ order: OrderRow; items: OrderItemRow[] }>>;
  findById(orderId: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null>;
}

export interface Repositories {
  products: ProductRepository;
  categories: CategoryRepository;
  users: UserRepository;
  carts: CartRepository;
  orders: OrderRepository;
}
