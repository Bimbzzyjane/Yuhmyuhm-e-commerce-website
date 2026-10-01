/**
 * API response types.
 *
 * These mirror `backend/src/domain/types.ts` exactly. They are duplicated
 * rather than shared because the two workspaces deploy independently (Vercel
 * vs. the API host) — a shared package would couple their release cycles for
 * no real benefit at this size.
 *
 * MONEY: every amount is an integer in MINOR units (kobo). `4500000` is ₦45,000.
 * Each amount arrives with a pre-rendered `*Label` from the server, so the UI
 * never has to do currency maths to display a price.
 */

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

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
}

export type ProductBadge = 'New' | 'Best Seller' | 'Limited';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string;
  category: CategoryRef | null;
  /** Integer kobo. */
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

export interface CartLine {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  unitPriceLabel: string;
  lineTotal: number;
  lineTotalLabel: string;
  product: ProductSummary;
  exceedsStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  userId: string | null;
  guestToken: string | null;
  status: 'active' | 'converted' | 'merged' | 'abandoned';
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  subtotalLabel: string;
  deliveryFee: number;
  deliveryFeeLabel: string;
  total: number;
  totalLabel: string;
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
  unitPrice: number;
  unitPriceLabel: string;
  quantity: number;
  lineTotal: number;
  lineTotalLabel: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';

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

/** The one error shape the API ever returns. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface CheckoutPayload {
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    notes?: string;
  };
}
