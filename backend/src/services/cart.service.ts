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
  /**
   * Read-only half of `resolveCart`.
   *
   * Kept separate so `addItem` can look the product and the cart up together
   * without creating a cart it might then not need: an unknown product must
   * still 404 without leaving an empty cart behind.
   */
  async function lookupCart(
    owner: CartOwner,
  ): Promise<{ cart: CartRow | null; guestToken: string | null }> {
    if (owner.userId) {
      return { cart: await repositories.carts.findActiveByUserId(owner.userId), guestToken: null };
    }

    const guestToken =
      owner.guestToken && UUID_PATTERN.test(owner.guestToken) ? owner.guestToken : randomUUID();

    return { cart: await repositories.carts.findActiveByGuestToken(guestToken), guestToken };
  }

  async function resolveCart(owner: CartOwner): Promise<CartRow> {
    const { cart, guestToken } = await lookupCart(owner);
    return cart ?? repositories.carts.create({ userId: owner.userId, guestToken });
  }

  /**
   * Drops lines whose product has since been deleted or unpublished, so a cart
   * can never show something that cannot be bought. Split out of `loadState`
   * because the add-to-cart path already holds these rows and must not pay to
   * re-read them just to prune.
   */
  async function pruneItems(
    cart: CartRow,
    items: CartItemRow[],
    productsById: Map<string, ProductRow>,
  ): Promise<CartItemRow[]> {
    const live: CartItemRow[] = [];
    for (const item of items) {
      if (productsById.get(item.productId)?.isActive) {
        live.push(item);
        continue;
      }
      // The product was deleted or unpublished after it was added.
      await repositories.carts.removeItem(cart.id, item.id);
      productsById.delete(item.productId);
    }
    return live;
  }

  async function loadState(cart: CartRow, pruneStale: boolean): Promise<CartState> {
    const items = await repositories.carts.listItems(cart.id);
    if (items.length === 0) return { cart, items: [], productsById: new Map() };

    const products = await repositories.products.findManyByIds(items.map((item) => item.productId));
    const productsById = new Map(products.map((product) => [product.id, product]));

    return {
      cart,
      items: pruneStale ? await pruneItems(cart, items, productsById) : items,
      productsById,
    };
  }

  /**
   * `preloaded` lets a caller that already holds the rows reuse them. It must
   * already be pruned, so the behaviour matches calling `loadState` again.
   */
  async function present(cart: CartRow, preloaded?: CartState): Promise<Cart> {
    const state = preloaded ?? (await loadState(cart, true));
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

    /**
     * Adds a line and re-renders the cart.
     *
     * Structured around round trips, because every one of them is a network hop
     * to the database (~200ms each against a remote Supabase project). The three
     * stages below are the minimum this can be done in:
     *
     *   1. product lookup || cart lookup   (independent reads)
     *   2. list the cart's lines
     *   3. upsert the line || touch the cart || price the other lines
     *
     * The old version took eight sequential trips: it read the cart twice (once
     * for the stock check, again to render) and did a read-then-write on the
     * cart item. Nothing here caches, so the cart is still read live on every
     * request and prices still come from the catalogue.
     */
    async addItem(owner: CartOwner, productId: string, quantity: number): Promise<Cart> {
      const [product, lookup] = await Promise.all([
        repositories.products.findById(productId),
        lookupCart(owner),
      ]);
      if (!product || !product.isActive) {
        // Still ahead of creating the cart, so a bad product leaves no orphan.
        throw new NotFoundError('We could not find that product.');
      }

      const cart =
        lookup.cart ??
        (await repositories.carts.create({ userId: owner.userId, guestToken: lookup.guestToken }));

      // One read serves both the stock check and the response below, so the
      // cart is listed exactly once per request.
      const before = await repositories.carts.listItems(cart.id);
      const existing = before.find((item) => item.productId === productId);
      const requested = (existing?.quantity ?? 0) + quantity;

      assertWithinLimits(product, requested);

      // Writing a line cannot change WHICH products the cart holds, so pricing
      // the other lines does not have to wait for the write to land. `line` is
      // the only new quantity in the cart, and `line` is returned by the upsert.
      const otherProductIds = [
        ...new Set(
          before.filter((item) => item.productId !== productId).map((item) => item.productId),
        ),
      ];

      const [line, , otherProducts] = await Promise.all([
        repositories.carts.upsertItem(cart.id, productId, requested),
        repositories.carts.touch(cart.id),
        repositories.products.findManyByIds(otherProductIds),
      ]);

      const productsById = new Map<string, ProductRow>([[product.id, product]]);
      for (const other of otherProducts) productsById.set(other.id, other);

      const items = existing
        ? before.map((item) => (item.productId === productId ? line : item))
        : [...before, line];

      return present(cart, {
        cart,
        items: await pruneItems(cart, items, productsById),
        productsById,
      });
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
