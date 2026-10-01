import type { AppConfig } from '../config/env';
import type { CustomerDetails, Order } from '../domain/types';
import type { Mailer } from '../email';
import {
  renderInternalOrderNotification,
  renderOrderConfirmation,
  type OrderEmailData,
} from '../email';
import type { NewOrderItemRow, Repositories, UserRow } from '../repositories/types';
import { EmptyCartError, ForbiddenError, NotFoundError, OutOfStockError } from '../utils/errors';
import { sumMinor } from '../utils/money';
import type { CartOwner, CartService } from './cart.service';
import { computeDelivery, toOrderDto } from './presenters';

export interface PlaceOrderInput {
  owner: CartOwner;
  /** Present when the shopper is signed in; null for a guest checkout. */
  user: UserRow | null;
  customer: CustomerDetails;
}

export interface OrderServiceDeps {
  repositories: Repositories;
  config: AppConfig;
  mailer: Mailer;
  cartService: CartService;
}

function formatPlacedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Africa/Lagos',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Order rules implemented here:
 *  - every price is re-read from the catalogue at submit time, so a tampered
 *    or stale client payload cannot influence what is charged;
 *  - `product_name` and `unit_price` are copied into `order_items`, making the
 *    order an immutable historical record;
 *  - the cart is consumed only after the order is durably stored;
 *  - a failure to send email never fails an order that already exists.
 */
export function createOrderService({
  repositories,
  config,
  mailer,
  cartService,
}: OrderServiceDeps) {
  function buildOrderEmail(order: Order): OrderEmailData {
    return {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      email: order.email,
      phone: order.phone,
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity,
      deliveryNotes: order.deliveryNotes,
      subtotalLabel: order.subtotalLabel,
      deliveryFeeLabel: order.deliveryFeeLabel,
      totalLabel: order.totalLabel,
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPriceLabel: item.unitPriceLabel,
        lineTotalLabel: item.lineTotalLabel,
      })),
      placedAtLabel: formatPlacedAt(order.createdAt),
      supportEmail: config.mail.fromAddress,
    };
  }

  async function sendOrderEmails(order: Order): Promise<void> {
    const data = buildOrderEmail(order);

    const confirmation = renderOrderConfirmation(data);
    try {
      await mailer.send({
        to: { address: order.email, name: order.customerName },
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
        replyTo: { address: config.mail.fromAddress, name: config.mail.fromName },
      });
    } catch (error) {
      console.error(`[orders] confirmation email failed for ${order.orderNumber}:`, error);
    }

    const notifyTo = config.mail.orderNotificationTo;
    if (notifyTo) {
      const internal = renderInternalOrderNotification(data);
      try {
        await mailer.send({
          to: { address: notifyTo },
          subject: internal.subject,
          html: internal.html,
          text: internal.text,
        });
      } catch (error) {
        console.error(`[orders] internal notification failed for ${order.orderNumber}:`, error);
      }
    }
  }

  return {
    async placeOrder({ owner, user, customer }: PlaceOrderInput): Promise<Order> {
      const state = await cartService.loadForCheckout(owner);
      if (state.items.length === 0) {
        throw new EmptyCartError('Your cart is empty — add something before checking out.');
      }

      // Re-price from the catalogue. Nothing price-related comes from the client.
      const lines: NewOrderItemRow[] = [];
      const unavailable: Array<{ productId: string; requested: number; available: number }> = [];

      for (const item of state.items) {
        const product = state.productsById.get(item.productId);
        if (!product || !product.isActive) {
          unavailable.push({ productId: item.productId, requested: item.quantity, available: 0 });
          continue;
        }
        if (item.quantity > product.stockQuantity) {
          unavailable.push({
            productId: product.id,
            requested: item.quantity,
            available: product.stockQuantity,
          });
          continue;
        }

        lines.push({
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          productImageUrl: product.imageUrl,
          unitPrice: product.price,
          quantity: item.quantity,
          lineTotal: product.price * item.quantity,
        });
      }

      if (unavailable.length > 0) {
        throw new OutOfStockError(
          'Some items in your cart are no longer available in the quantity you selected.',
          { items: unavailable },
        );
      }

      const subtotal = sumMinor(lines.map((line) => line.lineTotal));
      const { deliveryFee } = computeDelivery(subtotal, config);
      const total = subtotal + deliveryFee;

      const created = await repositories.orders.create({
        order: {
          userId: user?.id ?? null,
          customerName: customer.name,
          email: customer.email,
          phone: customer.phone,
          deliveryAddress: customer.address,
          deliveryCity: customer.city,
          deliveryNotes: customer.notes ?? null,
          subtotal,
          deliveryFee,
          total,
          status: 'pending',
        },
        items: lines,
      });

      // Stock is released to the shopper. Deliberately non-fatal: the order is
      // already stored, and failing the request here would leave the customer
      // convinced their checkout failed when it did not.
      for (const line of lines) {
        if (!line.productId) continue;
        try {
          await repositories.products.decrementStock(line.productId, line.quantity);
        } catch (error) {
          console.error(
            `[orders] stock decrement failed for product ${line.productId} on ${created.order.orderNumber}:`,
            error,
          );
        }
      }

      await cartService.consume(state.cart.id);

      const order = toOrderDto(created.order, created.items, config.currency);
      await sendOrderEmails(order);
      return order;
    },

    async listOrders(user: UserRow): Promise<Order[]> {
      const rows = await repositories.orders.listByUserId(user.id);
      return rows.map(({ order, items }) => toOrderDto(order, items, config.currency));
    },

    /** Owner-only: an authenticated shopper can never read someone else's order. */
    async getOrder(user: UserRow, orderId: string): Promise<Order> {
      const found = await repositories.orders.findById(orderId);
      if (!found) throw new NotFoundError('We could not find that order.');
      if (found.order.userId !== user.id) {
        throw new ForbiddenError('That order belongs to a different account.');
      }
      return toOrderDto(found.order, found.items, config.currency);
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
