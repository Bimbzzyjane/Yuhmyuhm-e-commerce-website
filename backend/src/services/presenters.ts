import type { AppConfig } from '../config/env';
import type {
  Cart,
  CartLine,
  Category,
  CategoryRef,
  Order,
  OrderLine,
  Paginated,
  Pagination,
  Product,
  ProductSummary,
  UserProfile,
} from '../domain/types';
import type {
  CartItemRow,
  CartRow,
  CategoryRow,
  OrderItemRow,
  OrderRow,
  ProductRow,
  UserRow,
} from '../repositories/types';
import { formatMoney, sumMinor } from '../utils/money';

/**
 * Presenters: repository rows -> API DTOs.
 *
 * This is the ONLY place that formats money for output and the only place that
 * decides which columns are public. Keeping it in one file means the API
 * surface can be reviewed at a glance.
 */

export function toCategoryDto(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toCategoryRef(row: ProductRow): CategoryRef {
  return { id: row.category.id, slug: row.category.slug, name: row.category.name };
}

export function toProductDto(row: ProductRow, currency: string): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    category: row.category.slug ? toCategoryRef(row) : null,
    price: row.price,
    priceLabel: formatMoney(row.price, currency),
    imageUrl: row.imageUrl,
    badge: row.badge,
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    stockQuantity: row.stockQuantity,
    inStock: row.isActive && row.stockQuantity > 0,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toProductSummary(row: ProductRow, currency: string): ProductSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.imageUrl,
    price: row.price,
    priceLabel: formatMoney(row.price, currency),
    stockQuantity: row.stockQuantity,
    inStock: row.isActive && row.stockQuantity > 0,
  };
}

export function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    authUserId: row.authUserId,
    email: row.email,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
    phone: row.phone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function buildPagination(total: number, limit: number, offset: number): Pagination {
  return { total, limit, offset, hasMore: offset + limit < total };
}

export function paginate<T>(data: T[], pagination: Pagination): Paginated<T> {
  return { data, pagination };
}

/**
 * Delivery pricing lives here and nowhere else, so there is exactly one rule
 * to reason about: free above the threshold, otherwise the flat fee — and an
 * empty cart is never charged for delivery.
 */
export function computeDelivery(
  subtotal: number,
  config: AppConfig,
): { deliveryFee: number; qualifiesForFreeDelivery: boolean } {
  if (subtotal <= 0) return { deliveryFee: 0, qualifiesForFreeDelivery: false };
  const qualifiesForFreeDelivery =
    config.freeDeliveryThreshold > 0 && subtotal >= config.freeDeliveryThreshold;
  return {
    deliveryFee: qualifiesForFreeDelivery ? 0 : config.deliveryFee,
    qualifiesForFreeDelivery,
  };
}

/**
 * Builds the cart DTO.
 *
 * The unit price is taken from the live product row, never from what the
 * shopper saw earlier, so a price change is reflected the next time the cart is
 * read — and the cart can never be used to buy at a stale price.
 */
export function toCartDto(input: {
  cart: CartRow;
  items: CartItemRow[];
  productsById: Map<string, ProductRow>;
  config: AppConfig;
}): Cart {
  const currency = input.config.currency;
  const lines: CartLine[] = [];

  for (const item of input.items) {
    const product = input.productsById.get(item.productId);
    // Defence in depth: the service prunes these, but never emit a broken line.
    if (!product) continue;

    const lineTotal = product.price * item.quantity;
    lines.push({
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: product.price,
      unitPriceLabel: formatMoney(product.price, currency),
      lineTotal,
      lineTotalLabel: formatMoney(lineTotal, currency),
      product: toProductSummary(product, currency),
      exceedsStock: item.quantity > product.stockQuantity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  const subtotal = sumMinor(lines.map((line) => line.lineTotal));
  const { deliveryFee, qualifiesForFreeDelivery } = computeDelivery(subtotal, input.config);
  const total = subtotal + deliveryFee;

  return {
    id: input.cart.id,
    userId: input.cart.userId,
    guestToken: input.cart.guestToken,
    status: input.cart.status,
    items: lines,
    itemCount: lines.reduce((count, line) => count + line.quantity, 0),
    subtotal,
    subtotalLabel: formatMoney(subtotal, currency),
    deliveryFee,
    deliveryFeeLabel: formatMoney(deliveryFee, currency),
    total,
    totalLabel: formatMoney(total, currency),
    qualifiesForFreeDelivery,
    currency,
    createdAt: input.cart.createdAt,
    updatedAt: input.cart.updatedAt,
  };
}

export function toOrderDto(order: OrderRow, items: OrderItemRow[], currency: string): Order {
  const lines: OrderLine[] = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    productSlug: item.productSlug,
    productImageUrl: item.productImageUrl,
    unitPrice: item.unitPrice,
    unitPriceLabel: formatMoney(item.unitPrice, currency),
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    lineTotalLabel: formatMoney(item.lineTotal, currency),
  }));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    customerName: order.customerName,
    email: order.email,
    phone: order.phone,
    deliveryAddress: order.deliveryAddress,
    deliveryCity: order.deliveryCity,
    deliveryNotes: order.deliveryNotes,
    subtotal: order.subtotal,
    subtotalLabel: formatMoney(order.subtotal, currency),
    deliveryFee: order.deliveryFee,
    deliveryFeeLabel: formatMoney(order.deliveryFee, currency),
    total: order.total,
    totalLabel: formatMoney(order.total, currency),
    currency,
    status: order.status,
    items: lines,
    itemCount: lines.reduce((count, line) => count + line.quantity, 0),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
