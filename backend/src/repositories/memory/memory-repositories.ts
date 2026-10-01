import { randomUUID } from 'node:crypto';
import type { AuthenticatedIdentity, CartStatus, OrderStatus } from '../../domain/types';
import { SEED_CATEGORIES, SEED_PRODUCTS } from '../../db/seed-data';
import { NotFoundError, OutOfStockError } from '../../utils/errors';
import type {
  CartItemRow,
  CartRepository,
  CartRow,
  CategoryRepository,
  CategoryRow,
  NewCategoryRow,
  NewOrderItemRow,
  NewOrderRow,
  NewProductRow,
  OrderItemRow,
  OrderRepository,
  OrderRow,
  Page,
  ProductQuery,
  ProductRepository,
  ProductRow,
  Repositories,
  UserRepository,
  UserRow,
} from '../types';

/**
 * In-memory implementation of every repository.
 *
 * Why this exists (and why it is not a toy):
 *  - `npm test` runs the real Express app against real repositories with no
 *    network, no database and no credentials.
 *  - `BACKEND_DATA_BACKEND=memory` gives a fully working API on a fresh clone,
 *    which is what makes the project demoable before Supabase is provisioned.
 *
 * It intentionally implements the SAME contracts and the same invariants as
 * the Supabase implementation (one active cart per owner, summed merges,
 * atomic order creation), so behaviour cannot silently diverge.
 */

const nowIso = (): string => new Date().toISOString();
const newId = (): string => randomUUID();

interface MemoryDatabase {
  categories: Map<string, CategoryRow>;
  products: Map<string, ProductRow>;
  users: Map<string, UserRow>;
  carts: Map<string, CartRow>;
  cartItems: Map<string, CartItemRow>;
  orders: Map<string, OrderRow>;
  orderItems: Map<string, OrderItemRow>;
  orderSequence: number;
}

function createDatabase(): MemoryDatabase {
  return {
    categories: new Map(),
    products: new Map(),
    users: new Map(),
    carts: new Map(),
    cartItems: new Map(),
    orders: new Map(),
    orderItems: new Map(),
    orderSequence: 0,
  };
}

// ---------------------------------------------------------------------------
// Shared lookups (small free functions keep the classes readable)
// ---------------------------------------------------------------------------

function findCategoryBySlug(db: MemoryDatabase, slug: string): CategoryRow | null {
  for (const category of db.categories.values()) {
    if (category.slug === slug) return category;
  }
  return null;
}

function categorySlugOf(db: MemoryDatabase, categoryId: string): string | null {
  return db.categories.get(categoryId)?.slug ?? null;
}

function findProductBySlug(db: MemoryDatabase, slug: string): ProductRow | null {
  for (const product of db.products.values()) {
    if (product.slug === slug) return product;
  }
  return null;
}

function findCartItem(db: MemoryDatabase, cartId: string, productId: string): CartItemRow | null {
  for (const item of db.cartItems.values()) {
    if (item.cartId === cartId && item.productId === productId) return item;
  }
  return null;
}

function findActiveCart(db: MemoryDatabase, predicate: (cart: CartRow) => boolean): CartRow | null {
  for (const cart of db.carts.values()) {
    if (cart.status === 'active' && predicate(cart)) return cart;
  }
  return null;
}

/**
 * Attaches the current category reference to a product on read, so a category
 * rename is reflected immediately everywhere (the Supabase implementation gets
 * the same result from an embedded join).
 */
function withCategoryRef(db: MemoryDatabase, product: ProductRow): ProductRow {
  const category = db.categories.get(product.categoryId);
  return {
    ...product,
    category: category
      ? { id: category.id, slug: category.slug, name: category.name }
      : { id: product.categoryId, slug: '', name: '' },
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

class MemoryCategoryRepository implements CategoryRepository {
  constructor(private readonly db: MemoryDatabase) {}

  async listWithCounts(options?: { activeOnly?: boolean }) {
    const activeOnly = options?.activeOnly ?? true;
    return [...this.db.categories.values()]
      .filter((category) => !activeOnly || category.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        productCount: [...this.db.products.values()].filter(
          (product) => product.categoryId === category.id && product.isActive,
        ).length,
      }));
  }

  async findBySlug(slug: string): Promise<CategoryRow | null> {
    return findCategoryBySlug(this.db, slug);
  }

  async upsertMany(rows: NewCategoryRow[]): Promise<number> {
    for (const row of rows) {
      const existing = findCategoryBySlug(this.db, row.slug);
      const timestamp = nowIso();
      const id = existing?.id ?? newId();
      this.db.categories.set(id, {
        id,
        slug: row.slug,
        name: row.name,
        description: row.description ?? existing?.description ?? null,
        imageUrl: row.imageUrl ?? existing?.imageUrl ?? null,
        sortOrder: row.sortOrder ?? existing?.sortOrder ?? 0,
        isActive: row.isActive ?? existing?.isActive ?? true,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
    }
    return rows.length;
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

class MemoryProductRepository implements ProductRepository {
  constructor(private readonly db: MemoryDatabase) {}

  async list(query: ProductQuery): Promise<Page<ProductRow>> {
    const search = query.search?.trim().toLowerCase();

    const rows = [...this.db.products.values()]
      .filter((product) => {
        if (!query.includeInactive && !product.isActive) return false;
        if (query.featured === true && !product.isFeatured) return false;
        if (
          query.categorySlug &&
          categorySlugOf(this.db, product.categoryId) !== query.categorySlug
        ) {
          return false;
        }
        if (search) {
          const haystack = `${product.name} ${product.description ?? ''}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (query.orderBy) {
          case 'priceAsc':
            return a.price - b.price || a.sortOrder - b.sortOrder;
          case 'priceDesc':
            return b.price - a.price || a.sortOrder - b.sortOrder;
          case 'newest':
            return b.createdAt.localeCompare(a.createdAt);
          default:
            return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
        }
      });

    return {
      rows: rows
        .slice(query.offset, query.offset + query.limit)
        .map((row) => withCategoryRef(this.db, row)),
      total: rows.length,
    };
  }

  async findById(id: string): Promise<ProductRow | null> {
    const product = this.db.products.get(id);
    return product ? withCategoryRef(this.db, product) : null;
  }

  async findByIdOrSlug(value: string): Promise<ProductRow | null> {
    const product = this.db.products.get(value) ?? findProductBySlug(this.db, value);
    return product ? withCategoryRef(this.db, product) : null;
  }

  async findManyByIds(ids: string[]): Promise<ProductRow[]> {
    return ids
      .map((id) => this.db.products.get(id))
      .filter((product): product is ProductRow => product !== undefined)
      .map((product) => withCategoryRef(this.db, product));
  }

  async upsertMany(rows: NewProductRow[]): Promise<number> {
    for (const row of rows) {
      const category = findCategoryBySlug(this.db, row.categorySlug);
      if (!category) {
        throw new NotFoundError(
          `Cannot seed product "${row.slug}": category "${row.categorySlug}" does not exist.`,
        );
      }
      const existing = findProductBySlug(this.db, row.slug);
      const timestamp = nowIso();
      const id = existing?.id ?? newId();
      this.db.products.set(id, {
        id,
        slug: row.slug,
        name: row.name,
        description: row.description ?? null,
        categoryId: category.id,
        category: { id: category.id, slug: category.slug, name: category.name },
        price: row.price,
        imageUrl: row.imageUrl ?? null,
        badge: row.badge ?? null,
        isFeatured: row.isFeatured ?? false,
        isActive: row.isActive ?? true,
        stockQuantity: row.stockQuantity ?? 0,
        sortOrder: row.sortOrder ?? 0,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
    }
    return rows.length;
  }

  async decrementStock(productId: string, quantity: number): Promise<void> {
    const product = this.db.products.get(productId);
    if (!product) throw new NotFoundError('That product is no longer available.');

    const next = product.stockQuantity - quantity;
    if (next < 0) {
      throw new OutOfStockError(
        `Only ${product.stockQuantity} unit(s) of ${product.name} remain in stock.`,
        { productId, available: product.stockQuantity, requested: quantity },
      );
    }

    this.db.products.set(productId, { ...product, stockQuantity: next, updatedAt: nowIso() });
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

class MemoryUserRepository implements UserRepository {
  constructor(private readonly db: MemoryDatabase) {}

  async findByAuthUserId(authUserId: string): Promise<UserRow | null> {
    for (const user of this.db.users.values()) {
      if (user.authUserId === authUserId) return user;
    }
    return null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const needle = email.toLowerCase();
    for (const user of this.db.users.values()) {
      if (user.email.toLowerCase() === needle) return user;
    }
    return null;
  }

  async upsertFromIdentity(identity: AuthenticatedIdentity): Promise<UserRow> {
    // Match on auth id first, then on email: the same human may have created
    // their profile with an email/password sign-up and then come back through
    // Google, which Supabase represents as a different auth id.
    const existing =
      (await this.findByAuthUserId(identity.authUserId)) ??
      (await this.findByEmail(identity.email));
    const timestamp = nowIso();
    const id = existing?.id ?? newId();
    const row: UserRow = {
      id,
      authUserId: identity.authUserId,
      email: identity.email,
      // Never overwrite a known name/avatar with a null from a later sign-in.
      fullName: identity.fullName ?? existing?.fullName ?? null,
      avatarUrl: identity.avatarUrl ?? existing?.avatarUrl ?? null,
      phone: existing?.phone ?? null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.db.users.set(id, row);
    return row;
  }
}

// ---------------------------------------------------------------------------
// Carts
// ---------------------------------------------------------------------------

class MemoryCartRepository implements CartRepository {
  constructor(private readonly db: MemoryDatabase) {}

  async findActiveByUserId(userId: string): Promise<CartRow | null> {
    return findActiveCart(this.db, (cart) => cart.userId === userId);
  }

  async findActiveByGuestToken(guestToken: string): Promise<CartRow | null> {
    return findActiveCart(this.db, (cart) => cart.guestToken === guestToken);
  }

  async findById(cartId: string): Promise<CartRow | null> {
    return this.db.carts.get(cartId) ?? null;
  }

  async create(owner: { userId?: string | null; guestToken?: string | null }): Promise<CartRow> {
    const timestamp = nowIso();
    const id = newId();
    const row: CartRow = {
      id,
      userId: owner.userId ?? null,
      guestToken: owner.guestToken ?? null,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.db.carts.set(id, row);
    return row;
  }

  async listItems(cartId: string): Promise<CartItemRow[]> {
    return [...this.db.cartItems.values()]
      .filter((item) => item.cartId === cartId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async addItem(cartId: string, productId: string, quantity: number): Promise<CartItemRow> {
    const existing = findCartItem(this.db, cartId, productId);
    const timestamp = nowIso();

    if (existing) {
      const updated: CartItemRow = {
        ...existing,
        quantity: existing.quantity + quantity,
        updatedAt: timestamp,
      };
      this.db.cartItems.set(existing.id, updated);
      return updated;
    }

    const id = newId();
    const row: CartItemRow = {
      id,
      cartId,
      productId,
      quantity,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.db.cartItems.set(id, row);
    return row;
  }

  async setItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartItemRow | null> {
    const existing = this.db.cartItems.get(itemId);
    // Scoping to the cart is what stops one shopper editing another's line.
    if (!existing || existing.cartId !== cartId) return null;

    const updated: CartItemRow = { ...existing, quantity, updatedAt: nowIso() };
    this.db.cartItems.set(itemId, updated);
    return updated;
  }

  async removeItem(cartId: string, itemId: string): Promise<boolean> {
    const existing = this.db.cartItems.get(itemId);
    if (!existing || existing.cartId !== cartId) return false;
    return this.db.cartItems.delete(itemId);
  }

  async clearItems(cartId: string): Promise<number> {
    let removed = 0;
    for (const [id, item] of this.db.cartItems) {
      if (item.cartId === cartId) {
        this.db.cartItems.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  async mergeInto(sourceCartId: string, targetCartId: string): Promise<void> {
    if (sourceCartId === targetCartId) return;

    // Quantities are summed rather than overwritten, so a guest who added two
    // cakes and then signed in to a cart holding one cake ends up with three.
    for (const item of await this.listItems(sourceCartId)) {
      await this.addItem(targetCartId, item.productId, item.quantity);
    }
    await this.clearItems(sourceCartId);
    await this.markStatus(sourceCartId, 'merged');
    await this.touch(targetCartId);
  }

  async markStatus(cartId: string, status: CartStatus): Promise<void> {
    const cart = this.db.carts.get(cartId);
    if (cart) this.db.carts.set(cartId, { ...cart, status, updatedAt: nowIso() });
  }

  async touch(cartId: string): Promise<void> {
    const cart = this.db.carts.get(cartId);
    if (cart) this.db.carts.set(cartId, { ...cart, updatedAt: nowIso() });
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

class MemoryOrderRepository implements OrderRepository {
  constructor(private readonly db: MemoryDatabase) {}

  private itemsOf(orderId: string): OrderItemRow[] {
    return [...this.db.orderItems.values()].filter((item) => item.orderId === orderId);
  }

  async create(input: { order: NewOrderRow; items: NewOrderItemRow[] }) {
    const timestamp = nowIso();
    const status: OrderStatus = input.order.status ?? 'pending';

    // Mirrors the Postgres sequence-backed default so order numbers are
    // unique and human readable in both backends: YM-2026-0001.
    this.db.orderSequence += 1;
    const orderNumber = `YM-${new Date().getFullYear()}-${String(this.db.orderSequence).padStart(4, '0')}`;

    const orderId = newId();
    const order: OrderRow = {
      id: orderId,
      orderNumber,
      userId: input.order.userId,
      customerName: input.order.customerName,
      email: input.order.email,
      phone: input.order.phone,
      deliveryAddress: input.order.deliveryAddress,
      deliveryCity: input.order.deliveryCity,
      deliveryNotes: input.order.deliveryNotes ?? null,
      subtotal: input.order.subtotal,
      deliveryFee: input.order.deliveryFee,
      total: input.order.total,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.db.orders.set(orderId, order);

    const items: OrderItemRow[] = input.items.map((item) => {
      const id = newId();
      const row: OrderItemRow = { id, orderId, ...item };
      this.db.orderItems.set(id, row);
      return row;
    });

    return { order, items };
  }

  async listByUserId(userId: string) {
    return [...this.db.orders.values()]
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((order) => ({ order, items: this.itemsOf(order.id) }));
  }

  async findById(orderId: string) {
    const order = this.db.orders.get(orderId);
    if (!order) return null;
    return { order, items: this.itemsOf(orderId) };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface MemoryRepositoryOptions {
  /** Set to false for a pristine, empty database (used by seed tests). */
  seed?: boolean;
}

/**
 * Builds a fully seeded, isolated set of repositories.
 * Every call gets its own database, so tests never leak state into each other.
 */
export async function createMemoryRepositories(
  options: MemoryRepositoryOptions = {},
): Promise<Repositories> {
  const db = createDatabase();

  const repositories: Repositories = {
    categories: new MemoryCategoryRepository(db),
    products: new MemoryProductRepository(db),
    users: new MemoryUserRepository(db),
    carts: new MemoryCartRepository(db),
    orders: new MemoryOrderRepository(db),
  };

  if (options.seed ?? true) {
    await repositories.categories.upsertMany(SEED_CATEGORIES);
    await repositories.products.upsertMany(SEED_PRODUCTS);
  }

  return repositories;
}
