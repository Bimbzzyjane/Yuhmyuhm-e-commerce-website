import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/env';
import type { Cart } from '../domain/types';
import type { CartItemRow, CartRow, ProductRow, Repositories } from '../repositories/types';
import { BadRequestError, NotFoundError, OutOfStockError, ValidationError } from '../utils/errors';
import { toCartDto } from './presenters';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who a cart belongs to. Identity is NEVER taken from the request body — it is
 * derived from a verified access token or the `X-Guest-Cart-Id` header, and
 * exactly one of these fields is set.
 */
export interface CartOwner {
  userId: string | null;
  guestToken: string | null;
}

export interface CartServiceDeps {
  repositories: Repositories;
  config: AppConfig;
}

export interface CartState {
  cart: CartRow;
  items: CartItemRow[];
  productsById: Map<string, ProductRow>;
}

/** Guards against a malformed guest token coming in from a header. */
export function isUuid(value: string | undefined | null): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function requireUuid(value: string | undefined | null, field: string): string {
  if (!isUuid(value)) throw new BadRequestError(`${field} must be a UUID.`);
  return value as string;
}

/**
 * Cart rules implemented here:
 *  - a signed-in shopper always has at most one active cart;
 *  - a guest cart is identified by a UUID the client stores and replays;
 *  - lines whose product is deleted or unpublished are pruned on read, so a
 *    cart can never show something that cannot be bought;
 *  - unit prices come from the catalogue at read time, never from the client.
 */
export function createCartService({ repositories, config }: CartServiceDeps) {
  async function resolveCart(owner: CartOwner): Promise<CartRow> {
    if (owner.userId) {
      const existing = await repositories.carts.findActiveByUserId(owner.userId);
      return existing ?? repositories.carts.create({ userId: owner.userId });
    }

    const token =
      owner.guestToken && UUID_PATTERN.test(owner.guestToken) ? owner.guestToken : randomUUID();

    const existing = await repositories.carts.findActiveByGuestToken(token);
    return existing ?? repositories.carts.create({ guestToken: token });
  }

  async function loadState(cart: CartRow, pruneStale: boolean): Promise<CartState> {
    const items = await repositories.carts.listItems(cart.id);
    if (items.length === 0) return { cart, items: [], productsById: new Map() };

    const products = await repositories.products.findManyByIds(items.map((item) => item.productId));
    const productsById = new Map(products.map((product) => [product.id, product]));

    const live: CartItemRow[] = [];
    for (const item of items) {
      const product = productsById.get(item.productId);
      if (product?.isActive) {
        live.push(item);
        continue;
      }
      // The product was deleted or unpublished after it was added.
      if (pruneStale) {
        await repositories.carts.removeItem(cart.id, item.id);
        productsById.delete(item.productId);
      }
    }

    return { cart, items: live, productsById };
  }

  async function present(cart: CartRow): Promise<Cart> {
    const state = await loadState(cart, true);
    return toCartDto({
      cart: state.cart,
      items: state.items,
      productsById: state.productsById,
      config,
    });
  }

  function assertWithinLimits(product: ProductRow, requested: number): void {
    if (requested > product.stockQuantity) {
      throw new OutOfStockError(
        product.stockQuantity === 0
          ? `${product.name} is currently out of stock.`
          : `Only ${product.stockQuantity} unit(s) of ${product.name} are available.`,
        { productId: product.id, available: product.stockQuantity, requested },
      );
    }
    if (requested > config.maxItemQuantity) {
      throw new ValidationError(
        `You can order at most ${config.maxItemQuantity} of a single item per order.`,
        { issues: [{ path: 'quantity', message: `must be ${config.maxItemQuantity} or fewer` }] },
      );
    }
  }

  return {
    /** Resolves (or lazily creates) the caller's cart and returns its DTO. */
    async getCart(owner: CartOwner): Promise<Cart> {
      return present(await resolveCart(owner));
    },

    async addItem(owner: CartOwner, productId: string, quantity: number): Promise<Cart> {
      const product = await repositories.products.findById(productId);
      if (!product || !product.isActive) {
        throw new NotFoundError('We could not find that product.');
      }

      const cart = await resolveCart(owner);
      const existing = (await repositories.carts.listItems(cart.id)).find(
        (item) => item.productId === productId,
      );
      const requested = (existing?.quantity ?? 0) + quantity;

      assertWithinLimits(product, requested);

      await repositories.carts.addItem(cart.id, productId, quantity);
      await repositories.carts.touch(cart.id);
      return present(cart);
    },

    async updateItem(owner: CartOwner, itemId: string, quantity: number): Promise<Cart> {
      const cart = await resolveCart(owner);

      // Quantity 0 is the API's way of saying "remove this line".
      if (quantity === 0) {
        await repositories.carts.removeItem(cart.id, itemId);
        return present(cart);
      }

      const item = (await repositories.carts.listItems(cart.id)).find(
        (candidate) => candidate.id === itemId,
      );
      if (!item) throw new NotFoundError('That item is not in your cart.');

      const product = await repositories.products.findById(item.productId);
      if (!product || !product.isActive) {
        await repositories.carts.removeItem(cart.id, itemId);
        throw new NotFoundError('That product is no longer available.');
      }

      assertWithinLimits(product, quantity);

      await repositories.carts.setItemQuantity(cart.id, itemId, quantity);
      await repositories.carts.touch(cart.id);
      return present(cart);
    },

    async removeItem(owner: CartOwner, itemId: string): Promise<Cart> {
      const cart = await resolveCart(owner);
      const removed = await repositories.carts.removeItem(cart.id, itemId);
      if (!removed) throw new NotFoundError('That item is not in your cart.');
      await repositories.carts.touch(cart.id);
      return present(cart);
    },

    async clearCart(owner: CartOwner): Promise<Cart> {
      const cart = await resolveCart(owner);
      await repositories.carts.clearItems(cart.id);
      await repositories.carts.touch(cart.id);
      return present(cart);
    },

    /**
     * Folds a guest cart into the signed-in shopper's cart, summing quantities.
     * The guest cart is then retired (`status = 'merged'`) so a stale browser
     * tab cannot replay it and double the order.
     */
    async mergeGuestCart(userId: string, guestToken: string): Promise<Cart> {
      const userCart = await resolveCart({ userId, guestToken: null });
      if (!guestToken || !UUID_PATTERN.test(guestToken)) return present(userCart);

      const guestCart = await repositories.carts.findActiveByGuestToken(guestToken);
      if (!guestCart || guestCart.id === userCart.id) return present(userCart);

      await repositories.carts.mergeInto(guestCart.id, userCart.id);
      return present(userCart);
    },

    /** Used by the order service; returns raw rows rather than a DTO. */
    async loadForCheckout(owner: CartOwner): Promise<CartState> {
      const cart = await resolveCart(owner);
      return loadState(cart, true);
    },

    /** Called after a successful checkout: the cart is spent. */
    async consume(cartId: string): Promise<void> {
      await repositories.carts.clearItems(cartId);
      await repositories.carts.markStatus(cartId, 'converted');
    },
  };
}

export type CartService = ReturnType<typeof createCartService>;
