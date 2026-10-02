/**
 * LIVE Supabase integration test — opt-in, never part of `npm test`.
 *
 * Atomicity is a property of the DATABASE, so it cannot be faked: proving that a
 * failed item insert rolls the order back needs a real Postgres. This file is
 * the only place that requirement is verified, and it runs only when a real
 * project is configured:
 *
 *   set -a && . ./.env && set +a && npx vitest run tests/supabase-orders.live.test.ts
 *
 * Everything it creates is deleted in `afterAll`, so the project is left exactly
 * as it was found. Credentials are read from the environment and never logged.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseRepositories } from '../src/repositories/supabase/supabase-repositories';
import type { NewOrderItemRow, NewOrderRow } from '../src/repositories/types';

const url = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Skipped (not failed) when no project is configured, so `npm test` — which sets
// no environment at all — stays green on a fresh checkout.
const live = Boolean(url && serviceRoleKey);
const describeLive = live ? describe : describe.skip;

/** Marks every row this file creates, so cleanup can find them precisely. */
const MARKER = 'integration-test-ym@local.invalid';

let client: SupabaseClient;
let orders: ReturnType<typeof createSupabaseRepositories>['orders'];

/** A real product, so the foreign key on `order_items.product_id` holds. */
let productId: string;

beforeAll(async () => {
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  orders = createSupabaseRepositories(client).orders;

  const { data, error } = await client
    .from('products')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`cannot read products: ${error.message}`);
  if (!data) throw new Error('no active product to order');
  productId = data.id;
});

afterAll(async () => {
  if (!live) return;
  // Every attempt (including the rollback ones) is tagged with MARKER, so a
  // `like` filter clears the whole file's footprint. `order_items` cascades from
  // `orders`, so one delete is enough.
  await client.from('orders').delete().like('email', `${MARKER}%`);
});

function newOrder(overrides: Partial<NewOrderRow> = {}): NewOrderRow {
  return {
    userId: null,
    customerName: 'Integration Test',
    email: MARKER,
    phone: '+2348000000000',
    deliveryAddress: '1 Test Street',
    deliveryCity: 'Lagos',
    deliveryNotes: null,
    subtotal: 2_250_000,
    deliveryFee: 250_000,
    total: 2_500_000,
    status: 'pending',
    ...overrides,
  };
}

function newItem(overrides: Partial<NewOrderItemRow> = {}): NewOrderItemRow {
  return {
    productId,
    productName: 'Integration Test Product',
    productSlug: 'integration-test-product',
    productImageUrl: null,
    unitPrice: 1_125_000,
    quantity: 2,
    lineTotal: 2_250_000,
    ...overrides,
  };
}

async function countOrders(email: string): Promise<number> {
  const { count, error } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('email', email);
  if (error) throw new Error(`cannot count orders: ${error.message}`);
  return count ?? 0;
}

describeLive('order creation against a live Supabase project', () => {
  it('writes the order and multiple line items in one call', async () => {
    const created = await orders.create({
      order: newOrder(),
      items: [
        newItem(),
        newItem({
          productName: 'Second Line',
          unitPrice: 250_000,
          quantity: 1,
          lineTotal: 250_000,
        }),
      ],
    });

    expect(created.order.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.order.orderNumber).toMatch(/^YM-\d{4}-\d{4}$/);
    expect(created.items).toHaveLength(2);

    // Read back through a second, independent path (not the RPC's own return).
    const { data, error } = await client
      .from('order_items')
      .select('id, order_id, product_name, unit_price, quantity, line_total')
      .eq('order_id', created.order.id)
      .order('id');
    if (error) throw new Error(`cannot read order_items: ${error.message}`);

    expect(data).toHaveLength(2);
    for (const row of data) {
      expect(row.order_id).toBe(created.order.id);
    }
    expect(data.map((row) => row.product_name).sort()).toEqual([
      'Integration Test Product',
      'Second Line',
    ]);
  });

  it('rolls the whole transaction back when an item fails, leaving no orphan order', async () => {
    // Each attempt gets its OWN email, so "did this attempt persist anything?" is
    // a precise question rather than a count that other tests could perturb.
    const email = `${MARKER}-rollback`;

    // `quantity > 0` is a CHECK on order_items, and the valid line is inserted
    // FIRST — so the function must roll back work it already completed.
    await expect(
      orders.create({
        order: newOrder({ email }),
        items: [newItem(), newItem({ quantity: 0 })],
      }),
    ).rejects.toThrow(/create order failed/);

    // The parent insert happened first and was rolled back with the child, so
    // this is the precise "no orphaned order" check.
    expect(await countOrders(email)).toBe(0);
  });

  it('never leaves an order behind when the very first item is rejected', async () => {
    const email = `${MARKER}-first-item`;

    await expect(
      orders.create({ order: newOrder({ email }), items: [newItem({ quantity: -5 })] }),
    ).rejects.toThrow(/create order failed/);

    expect(await countOrders(email)).toBe(0);
  });

  it('rejects an item whose product_id violates the foreign key', async () => {
    const email = `${MARKER}-bad-fk`;

    await expect(
      orders.create({
        order: newOrder({ email }),
        items: [newItem({ productId: '00000000-0000-4000-8000-000000000000' })],
      }),
    ).rejects.toThrow(/create order failed/);

    expect(await countOrders(email)).toBe(0);
  });
});
