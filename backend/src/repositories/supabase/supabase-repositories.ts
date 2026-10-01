import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthenticatedIdentity,
  CartStatus,
  OrderStatus,
  ProductBadge,
} from '../../domain/types';
import { PG_UNIQUE_VIOLATION } from '../../db/supabase-client';
import { ConflictError, NotFoundError, OutOfStockError } from '../../utils/errors';
import { fromMinor, toMinor } from '../../utils/money';
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
 * Supabase/PostgREST implementation of every repository. This is the
 * production path (`BACKEND_DATA_BACKEND=supabase`).
 *
 * Two rules are enforced here:
 *  1. Money is converted at this boundary only (numeric <-> integer kobo), so
 *     nothing above this layer ever sees a decimal string.
 *  2. `snake_case` never escapes this file — everything returned is the
 *     camelCase row shape defined in repositories/types.ts.
 */

interface PostgrestError {
  message: string;
  code?: string;
}

interface PostgrestResult {
  data: unknown;
  error: PostgrestError | null;
}

/** Throws on a PostgREST error; callers pass the expected data shape. */
function ok<T>(result: PostgrestResult, context: string): T {
  if (result.error) throw new Error(`${context} failed: ${result.error.message}`);
  return result.data as T;
}

/** PostgREST returns `null` (not an error) when no row matches. */
function okMaybe<T>(result: PostgrestResult, context: string): T | null {
  return ok<T | null>(result, context);
}

function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === PG_UNIQUE_VIOLATION;
}

function raiseConflict(context: string, error: PostgrestError | null): never {
  throw new ConflictError(`${context} conflicted with existing data.`, {
    code: error?.code,
    message: error?.message,
  });
}

// ---------------------------------------------------------------------------
// Database row shapes (snake_case)
// ---------------------------------------------------------------------------

interface CategoryDbRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductDbRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: string;
  price: string | number;
  image_url: string | null;
  badge: string | null;
  is_featured: boolean;
  is_active: boolean;
  stock_quantity: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: { id: string; slug: string; name: string } | null;
}

interface UserDbRow {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

interface CartDbRow {
  id: string;
  user_id: string | null;
  guest_token: string | null;
  status: CartStatus;
  created_at: string;
  updated_at: string;
}

interface CartItemDbRow {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

interface OrderDbRow {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  email: string;
  phone: string;
  delivery_address: string;
  delivery_city: string;
  delivery_notes: string | null;
  subtotal: string | number;
  delivery_fee: string | number;
  total: string | number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

interface OrderItemDbRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string | null;
  product_image_url: string | null;
  unit_price: string | number;
  quantity: number;
  line_total: string | number;
}

const PRODUCT_SELECT = '*, category:categories(id, slug, name)';

// ---------------------------------------------------------------------------
// Mappers (snake_case row -> camelCase row)
// ---------------------------------------------------------------------------

function mapCategory(row: CategoryDbRow): CategoryRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProduct(row: ProductDbRow): ProductRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    category: row.category
      ? { id: row.category.id, slug: row.category.slug, name: row.category.name }
      : { id: row.category_id, slug: '', name: '' },
    price: toMinor(row.price),
    imageUrl: row.image_url,
    badge: (row.badge as ProductBadge | null) ?? null,
    isFeatured: row.is_featured,
    isActive: row.is_active,
    stockQuantity: row.stock_quantity,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUser(row: UserDbRow): UserRow {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCart(row: CartDbRow): CartRow {
  return {
    id: row.id,
    userId: row.user_id,
    guestToken: row.guest_token,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCartItem(row: CartItemDbRow): CartItemRow {
  return {
    id: row.id,
    cartId: row.cart_id,
    productId: row.product_id,
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrderItem(item: OrderItemDbRow): OrderItemRow {
  return {
    id: item.id,
    orderId: item.order_id,
    productId: item.product_id,
    productName: item.product_name,
    productSlug: item.product_slug,
    productImageUrl: item.product_image_url,
    unitPrice: toMinor(item.unit_price),
    quantity: item.quantity,
    lineTotal: toMinor(item.line_total),
  };
}

function mapOrder(
  row: OrderDbRow,
  items: OrderItemDbRow[],
): {
  order: OrderRow;
  items: OrderItemRow[];
} {
  return {
    order: {
      id: row.id,
      orderNumber: row.order_number,
      userId: row.user_id,
      customerName: row.customer_name,
      email: row.email,
      phone: row.phone,
      deliveryAddress: row.delivery_address,
      deliveryCity: row.delivery_city,
      deliveryNotes: row.delivery_notes,
      subtotal: toMinor(row.subtotal),
      deliveryFee: toMinor(row.delivery_fee),
      total: toMinor(row.total),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    items: items.map(mapOrderItem),
  };
}

/** Escapes the characters that would otherwise break a PostgREST `or` filter. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()\\]/g, ' ').trim();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

class SupabaseCategoryRepository implements CategoryRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listWithCounts(options?: { activeOnly?: boolean }) {
    const activeOnly = options?.activeOnly ?? true;
    const base = this.db.from('categories').select('*');
    const filtered = activeOnly ? base.eq('is_active', true) : base;
    const rows = ok<CategoryDbRow[]>(
      await filtered.order('sort_order').order('name'),
      'list categories',
    );

    // Counts come from the products table (rather than an embedded aggregate)
    // so they can be restricted to active products.
    const productRows = ok<Array<{ category_id: string }>>(
      await this.db.from('products').select('category_id').eq('is_active', true),
      'count products',
    );
    const counts = new Map<string, number>();
    for (const product of productRows) {
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }

    return rows.map((row) => ({ ...mapCategory(row), productCount: counts.get(row.id) ?? 0 }));
  }

  async findBySlug(slug: string): Promise<CategoryRow | null> {
    const row = okMaybe<CategoryDbRow>(
      await this.db.from('categories').select('*').eq('slug', slug).maybeSingle(),
      'find category',
    );
    return row ? mapCategory(row) : null;
  }

  async upsertMany(rows: NewCategoryRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const payload = rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description ?? null,
      image_url: row.imageUrl ?? null,
      sort_order: row.sortOrder ?? 0,
      is_active: row.isActive ?? true,
    }));
    ok<CategoryDbRow[]>(
      await this.db.from('categories').upsert(payload, { onConflict: 'slug' }).select(),
      'upsert categories',
    );
    return rows.length;
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(query: ProductQuery): Promise<Page<ProductRow>> {
    // Resolving the category first keeps the request free of PostgREST
    // embedded-filter syntax, which is easy to get subtly wrong.
    let categoryId: string | null = null;
    if (query.categorySlug) {
      const category = await new SupabaseCategoryRepository(this.db).findBySlug(query.categorySlug);
      if (!category) return { rows: [], total: 0 };
      categoryId = category.id;
    }

    const search = query.search ? sanitizeSearchTerm(query.search) : '';

    let builder = this.db.from('products').select(PRODUCT_SELECT, { count: 'exact' });
    if (!query.includeInactive) builder = builder.eq('is_active', true);
    if (query.featured === true) builder = builder.eq('is_featured', true);
    if (categoryId) builder = builder.eq('category_id', categoryId);
    if (search) builder = builder.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

    switch (query.orderBy) {
      case 'priceAsc':
        builder = builder.order('price', { ascending: true });
        break;
      case 'priceDesc':
        builder = builder.order('price', { ascending: false });
        break;
      case 'newest':
        builder = builder.order('created_at', { ascending: false });
        break;
      default:
        builder = builder.order('sort_order').order('name');
    }

    const response = await builder.range(query.offset, query.offset + query.limit - 1);
    if (response.error) throw new Error(`list products failed: ${response.error.message}`);

    const rows = (response.data ?? []) as unknown as ProductDbRow[];
    return { rows: rows.map(mapProduct), total: response.count ?? rows.length };
  }

  async findById(id: string): Promise<ProductRow | null> {
    if (!UUID_PATTERN.test(id)) return null;
    const row = okMaybe<ProductDbRow>(
      await this.db.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle(),
      'find product by id',
    );
    return row ? mapProduct(row) : null;
  }

  async findByIdOrSlug(value: string): Promise<ProductRow | null> {
    const column = UUID_PATTERN.test(value) ? 'id' : 'slug';
    const row = okMaybe<ProductDbRow>(
      await this.db.from('products').select(PRODUCT_SELECT).eq(column, value).maybeSingle(),
      'find product',
    );
    return row ? mapProduct(row) : null;
  }

  async findManyByIds(ids: string[]): Promise<ProductRow[]> {
    if (ids.length === 0) return [];
    const rows = ok<ProductDbRow[]>(
      await this.db.from('products').select(PRODUCT_SELECT).in('id', ids),
      'find products by ids',
    );
    return rows.map(mapProduct);
  }

  async upsertMany(rows: NewProductRow[]): Promise<number> {
    if (rows.length === 0) return 0;

    const categories = ok<CategoryDbRow[]>(
      await this.db.from('categories').select('*'),
      'load categories for seeding',
    );
    const idBySlug = new Map(categories.map((category) => [category.slug, category.id]));

    const payload = rows.map((row) => {
      const categoryId = idBySlug.get(row.categorySlug);
      if (!categoryId) {
        throw new Error(
          `Cannot seed product "${row.slug}": category "${row.categorySlug}" does not exist.`,
        );
      }
      return {
        slug: row.slug,
        name: row.name,
        description: row.description ?? null,
        category_id: categoryId,
        price: fromMinor(row.price),
        image_url: row.imageUrl ?? null,
        badge: row.badge ?? null,
        is_featured: row.isFeatured ?? false,
        is_active: row.isActive ?? true,
        stock_quantity: row.stockQuantity ?? 0,
        sort_order: row.sortOrder ?? 0,
      };
    });

    ok<ProductDbRow[]>(
      await this.db.from('products').upsert(payload, { onConflict: 'slug' }).select(),
      'upsert products',
    );
    return rows.length;
  }

  async decrementStock(productId: string, quantity: number): Promise<void> {
    const current = okMaybe<{ name: string; stock_quantity: number }>(
      await this.db
        .from('products')
        .select('name, stock_quantity')
        .eq('id', productId)
        .maybeSingle(),
      'read stock',
    );
    if (!current) throw new NotFoundError('That product is no longer available.');

    const next = current.stock_quantity - quantity;
    if (next < 0) {
      throw new OutOfStockError(
        `Only ${current.stock_quantity} unit(s) of ${current.name} remain in stock.`,
        { productId, available: current.stock_quantity, requested: quantity },
      );
    }

    // Optimistic locking: the update only applies if nobody else changed the
    // stock level in the meantime, so two simultaneous checkouts cannot both
    // sell the last unit.
    const updated = ok<Array<{ id: string }>>(
      await this.db
        .from('products')
        .update({ stock_quantity: next, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .eq('stock_quantity', current.stock_quantity)
        .select('id'),
      'decrement stock',
    );

    if (updated.length === 0) {
      throw new OutOfStockError(
        'Stock for that item changed while you were checking out. Please review your cart.',
        { productId },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

class SupabaseUserRepository implements UserRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByAuthUserId(authUserId: string): Promise<UserRow | null> {
    const row = okMaybe<UserDbRow>(
      await this.db.from('users').select('*').eq('auth_user_id', authUserId).maybeSingle(),
      'find user',
    );
    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    // `ilike` makes the match case-insensitive. `.limit(1)` rather than
    // `maybeSingle()` because Postgres `unique` on email is case-sensitive, so
    // in principle two rows could differ only by case; `maybeSingle` would then
    // throw instead of returning one.
    const rows = ok<UserDbRow[]>(
      await this.db.from('users').select('*').ilike('email', email).limit(1),
      'find user by email',
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async upsertFromIdentity(identity: AuthenticatedIdentity): Promise<UserRow> {
    // Match on auth id, then on email: the same person may have signed up with
    // an email and password and later returned through Google, which Supabase
    // represents as a different auth id but the same address.
    const existing =
      (await this.findByAuthUserId(identity.authUserId)) ??
      (await this.findByEmail(identity.email));
    const timestamp = new Date().toISOString();

    // Never overwrite a known name/avatar with a null from a later sign-in.
    const payload = {
      auth_user_id: identity.authUserId,
      email: identity.email,
      full_name: identity.fullName ?? existing?.fullName ?? null,
      avatar_url: identity.avatarUrl ?? existing?.avatarUrl ?? null,
      updated_at: timestamp,
    };

    if (existing) {
      const row = ok<UserDbRow>(
        await this.db.from('users').update(payload).eq('id', existing.id).select().single(),
        'update user',
      );
      return mapUser(row);
    }

    const insert = await this.db.from('users').insert(payload).select().single();
    if (isUniqueViolation(insert.error)) {
      // Lost a race against a concurrent first sign-in.
      const row = await this.findByAuthUserId(identity.authUserId);
      if (row) return row;
    }
    if (insert.error) raiseConflict('create user', insert.error);
    return mapUser(insert.data as UserDbRow);
  }
}

// ---------------------------------------------------------------------------
// Carts
// ---------------------------------------------------------------------------

class SupabaseCartRepository implements CartRepository {
  constructor(private readonly db: SupabaseClient) {}

  private async findActive(
    column: 'user_id' | 'guest_token',
    value: string,
  ): Promise<CartRow | null> {
    const row = okMaybe<CartDbRow>(
      await this.db
        .from('carts')
        .select('*')
        .eq(column, value)
        .eq('status', 'active')
        .maybeSingle(),
      'find active cart',
    );
    return row ? mapCart(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<CartRow | null> {
    return this.findActive('user_id', userId);
  }

  async findActiveByGuestToken(guestToken: string): Promise<CartRow | null> {
    return this.findActive('guest_token', guestToken);
  }

  async findById(cartId: string): Promise<CartRow | null> {
    if (!UUID_PATTERN.test(cartId)) return null;
    const row = okMaybe<CartDbRow>(
      await this.db.from('carts').select('*').eq('id', cartId).maybeSingle(),
      'find cart',
    );
    return row ? mapCart(row) : null;
  }

  async create(owner: { userId?: string | null; guestToken?: string | null }): Promise<CartRow> {
    const insert = await this.db
      .from('carts')
      .insert({
        user_id: owner.userId ?? null,
        guest_token: owner.guestToken ?? null,
        status: 'active',
      })
      .select()
      .single();

    // The partial unique indexes from schema.sql make a concurrent duplicate
    // impossible; if we lose that race we simply reuse the winner.
    if (isUniqueViolation(insert.error)) {
      const existing = owner.userId
        ? await this.findActiveByUserId(owner.userId)
        : owner.guestToken
          ? await this.findActiveByGuestToken(owner.guestToken)
          : null;
      if (existing) return existing;
    }

    ok<CartDbRow>(insert, 'create cart');
    return mapCart(insert.data as CartDbRow);
  }

  async listItems(cartId: string): Promise<CartItemRow[]> {
    const rows = ok<CartItemDbRow[]>(
      await this.db.from('cart_items').select('*').eq('cart_id', cartId).order('created_at'),
      'list cart items',
    );
    return rows.map(mapCartItem);
  }

  private async incrementItem(item: CartItemDbRow, quantity: number): Promise<CartItemRow> {
    const row = ok<CartItemDbRow>(
      await this.db
        .from('cart_items')
        .update({ quantity: item.quantity + quantity, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .select()
        .single(),
      'increment cart item',
    );
    return mapCartItem(row);
  }

  async addItem(cartId: string, productId: string, quantity: number): Promise<CartItemRow> {
    const existing = okMaybe<CartItemDbRow>(
      await this.db
        .from('cart_items')
        .select('*')
        .eq('cart_id', cartId)
        .eq('product_id', productId)
        .maybeSingle(),
      'find cart item',
    );

    if (existing) return this.incrementItem(existing, quantity);

    const insert = await this.db
      .from('cart_items')
      .insert({ cart_id: cartId, product_id: productId, quantity })
      .select()
      .single();

    if (isUniqueViolation(insert.error)) {
      // Someone inserted the same line between our read and our write.
      const raced = okMaybe<CartItemDbRow>(
        await this.db
          .from('cart_items')
          .select('*')
          .eq('cart_id', cartId)
          .eq('product_id', productId)
          .maybeSingle(),
        'refind cart item',
      );
      if (raced) return this.incrementItem(raced, quantity);
    }

    ok<CartItemDbRow>(insert, 'add cart item');
    return mapCartItem(insert.data as CartItemDbRow);
  }

  async setItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartItemRow | null> {
    if (!UUID_PATTERN.test(itemId)) return null;
    // Scoping the update to the cart is what stops one shopper editing
    // another shopper's line.
    const row = okMaybe<CartItemDbRow>(
      await this.db
        .from('cart_items')
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('cart_id', cartId)
        .select()
        .maybeSingle(),
      'set cart item quantity',
    );
    return row ? mapCartItem(row) : null;
  }

  async removeItem(cartId: string, itemId: string): Promise<boolean> {
    if (!UUID_PATTERN.test(itemId)) return false;
    const rows = ok<Array<{ id: string }>>(
      await this.db.from('cart_items').delete().eq('id', itemId).eq('cart_id', cartId).select('id'),
      'remove cart item',
    );
    return rows.length > 0;
  }

  async clearItems(cartId: string): Promise<number> {
    const rows = ok<Array<{ id: string }>>(
      await this.db.from('cart_items').delete().eq('cart_id', cartId).select('id'),
      'clear cart items',
    );
    return rows.length;
  }

  async mergeInto(sourceCartId: string, targetCartId: string): Promise<void> {
    if (sourceCartId === targetCartId) return;
    for (const item of await this.listItems(sourceCartId)) {
      await this.addItem(targetCartId, item.productId, item.quantity);
    }
    await this.clearItems(sourceCartId);
    await this.markStatus(sourceCartId, 'merged');
    await this.touch(targetCartId);
  }

  async markStatus(cartId: string, status: CartStatus): Promise<void> {
    ok<CartDbRow[]>(
      await this.db
        .from('carts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', cartId)
        .select(),
      'update cart status',
    );
  }

  async touch(cartId: string): Promise<void> {
    ok<CartDbRow[]>(
      await this.db
        .from('carts')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', cartId)
        .select(),
      'touch cart',
    );
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

type OrderWithItems = OrderDbRow & { order_items: OrderItemDbRow[] | null };

class SupabaseOrderRepository implements OrderRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: { order: NewOrderRow; items: NewOrderItemRow[] }) {
    // Nested insert: PostgREST performs the parent insert and the child inserts
    // inside a single transaction, so an order can never be persisted without
    // its line items.
    const payload = {
      user_id: input.order.userId,
      customer_name: input.order.customerName,
      email: input.order.email,
      phone: input.order.phone,
      delivery_address: input.order.deliveryAddress,
      delivery_city: input.order.deliveryCity,
      delivery_notes: input.order.deliveryNotes ?? null,
      subtotal: fromMinor(input.order.subtotal),
      delivery_fee: fromMinor(input.order.deliveryFee),
      total: fromMinor(input.order.total),
      status: input.order.status ?? 'pending',
      order_items: input.items.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        product_slug: item.productSlug,
        product_image_url: item.productImageUrl,
        unit_price: fromMinor(item.unitPrice),
        quantity: item.quantity,
        line_total: fromMinor(item.lineTotal),
      })),
    };

    // `order_number` is deliberately omitted: the Postgres default assigns it
    // from a sequence, which cannot collide under concurrency.
    const row = ok<OrderWithItems>(
      await this.db.from('orders').insert(payload).select('*, order_items(*)').single(),
      'create order',
    );
    return mapOrder(row, row.order_items ?? []);
  }

  async listByUserId(userId: string) {
    const rows = ok<OrderWithItems[]>(
      await this.db
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      'list orders',
    );
    return rows.map((row) => mapOrder(row, row.order_items ?? []));
  }

  async findById(orderId: string) {
    if (!UUID_PATTERN.test(orderId)) return null;
    const row = okMaybe<OrderWithItems>(
      await this.db.from('orders').select('*, order_items(*)').eq('id', orderId).maybeSingle(),
      'find order',
    );
    return row ? mapOrder(row, row.order_items ?? []) : null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSupabaseRepositories(client: SupabaseClient): Repositories {
  return {
    categories: new SupabaseCategoryRepository(client),
    products: new SupabaseProductRepository(client),
    users: new SupabaseUserRepository(client),
    carts: new SupabaseCartRepository(client),
    orders: new SupabaseOrderRepository(client),
  };
}
