/**
 * API response types.
 *
 * These mirror `backend/src/domain/types.ts` exactly, which is the only place
 * that decides the public shape of a response. They are duplicated (rather than
 * shared) because `mobile/` is a standalone project that must keep building even
 * if the API host is unavailable.
 *
 * MONEY: every amount is an integer in MINOR units (kobo). `4500000` is
 * ₦45,000. Each amount arrives with a pre-rendered `*Label` from the server, so
 * the UI never has to do currency maths to display a price — render the
 * `*Label` exactly as received.
 */

export type ProductBadge = 'New' | 'Best Seller' | 'Limited';

export type CartStatus = 'active' | 'converted' | 'merged' | 'abandoned';

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
}

export interface Category {
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

export interface CategoryWithCount extends Category {
  productCount: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string;
  category: CategoryRef | null;
  /** Integer kobo. */
  price: number;
  /** Pre-rendered for display, e.g. "₦45,000". Prefer this over `price`. */
  priceLabel: string;
  imageUrl: string | null;
  badge: ProductBadge | null;
  isFeatured: boolean;
  isActive: boolean;
  stockQuantity: number;
  inStock: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Just enough product data to render a cart row. */
export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** Integer kobo. */
  price: number;
  priceLabel: string;
  stockQuantity: number;
  inStock: boolean;
}

export interface CartLine {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  /** Live unit price in kobo — always re-read from the catalogue by the API. */
  unitPrice: number;
  unitPriceLabel: string;
  lineTotal: number;
  lineTotalLabel: string;
  product: ProductSummary;
  /** True when the requested quantity exceeds what is in stock. */
  exceedsStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  /** Set when the cart belongs to a signed-in account; null for a guest cart. */
  userId: string | null;
  /** Present only for guest carts; the client persists it. */
  guestToken: string | null;
  status: CartStatus;
  items: CartLine[];
  /** Total number of units (not distinct lines). */
  itemCount: number;
  subtotal: number;
  subtotalLabel: string;
  deliveryFee: number;
  deliveryFeeLabel: string;
  total: number;
  totalLabel: string;
  /** True when the free-delivery threshold has been reached. */
  qualifiesForFreeDelivery: boolean;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

/** The API's own profile row for a signed-in user (`GET /api/auth/me`). */
export interface UserProfile {
  id: string;
  authUserId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}
