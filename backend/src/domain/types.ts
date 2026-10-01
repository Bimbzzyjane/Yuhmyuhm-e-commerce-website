/**
 * Domain types — the shape everything inside the API works with.
 *
 * Conventions:
 *  - Money is ALWAYS integer minor units (kobo); see utils/money.ts.
 *  - Every money field is paired with a `*Label` string so clients never have
 *    to format currency themselves.
 *  - These objects are also the API's response shape (camelCase, no raw DB
 *    rows leaking out), so repositories are responsible for the snake_case
 *    translation.
 */

export type CartStatus = 'active' | 'converted' | 'merged' | 'abandoned';

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'delivered',
  'cancelled',
] as const;

/** Short marketing flag rendered as a pill on the product card. */
export type ProductBadge = 'New' | 'Best Seller' | 'Limited';

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

/** The trimmed category embedded in a product payload. */
export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string;
  category: CategoryRef | null;
  /** Integer minor units (kobo). */
  price: number;
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

export interface CartLine {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  /** Live unit price in minor units — always re-read from the catalogue. */
  unitPrice: number;
  unitPriceLabel: string;
  lineTotal: number;
  lineTotalLabel: string;
  /**
   * Always present: the cart service prunes lines whose product has been
   * deleted or deactivated, so a cart can never reference a ghost product.
   */
  product: ProductSummary;
  /** True when the requested quantity exceeds what is in stock. */
  exceedsStock: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Just enough product data to render a cart row. */
export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  priceLabel: string;
  stockQuantity: number;
  inStock: boolean;
}

export interface Cart {
  id: string;
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

export interface OrderLine {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  productImageUrl: string | null;
  /** Frozen at purchase time — later catalogue edits must not change this. */
  unitPrice: number;
  unitPriceLabel: string;
  quantity: number;
  lineTotal: number;
  lineTotalLabel: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNotes: string | null;
  subtotal: number;
  subtotalLabel: string;
  deliveryFee: number;
  deliveryFeeLabel: string;
  total: number;
  totalLabel: string;
  currency: string;
  status: OrderStatus;
  items: OrderLine[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

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

/** Fields collected at checkout. */
export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes?: string | null;
}

/** Identity resolved from a verified access token. */
export interface AuthenticatedIdentity {
  authUserId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
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
