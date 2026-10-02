/**
 * Supabase-specific order creation.
 *
 * The regression this guards: `SupabaseOrderRepository.create()` used to send
 * `order_items` as a key inside an `orders` insert, relying on PostgREST's
 * nested insert. That feature is unavailable on this deployment (PostgREST
 * answers PGRST204, "Could not find the 'order_items' column of 'orders'"), so
 * every checkout returned 500. The repository now calls the
 * `create_order_with_items` Postgres function through `rpc()`, which writes the
 * order and its line items in one transaction.
 *
 * None of this is observable through the in-memory repositories, which is
 * exactly why the whole suite missed it — so these tests drive the Supabase
 * repository directly, against a fake client that records the calls. No
 * credentials, no network.
 *
 * Atomicity (rollback, no orphaned orders) is a property of the DATABASE, so
 * it is covered separately by the opt-in `supabase-orders.live.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMemoryRepositories } from '../src/repositories/memory/memory-repositories';
import { createSupabaseRepositories } from '../src/repositories/supabase/supabase-repositories';
import type {
  NewOrderItemRow,
  NewOrderRow,
  OrderItemRow,
  OrderRow,
} from '../src/repositories/types';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_IDS = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const PRODUCT_IDS = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
];

const newOrder: NewOrderRow = {
  userId: null,
  customerName: 'Amaka Obi',
  email: 'amaka@example.com',
  phone: '+2348000000000',
  deliveryAddress: '12 Allen Avenue, Ikoyi',
  deliveryCity: 'Lagos',
  deliveryNotes: 'Leave with the concierge',
  // Minor units (kobo). 45,000.00 and 2,500.00.
  subtotal: 4_500_000,
  deliveryFee: 250_000,
  total: 4_750_000,
  status: 'pending',
};

const newItems: NewOrderItemRow[] = [
  {
    productId: PRODUCT_IDS[0],
    productName: 'Chocolate Delight Cake',
    productSlug: 'chocolate-delight-cake',
    productImageUrl: '/images/catalog/chocolate-delight-cake.jpg',
    unitPrice: 2_250_000,
    quantity: 2,
    lineTotal: 4_500_000,
  },
  {
    productId: PRODUCT_IDS[1],
    productName: 'Stand Mixer',
    productSlug: 'stand-mixer',
    productImageUrl: null,
    unitPrice: 2_500_000,
    quantity: 1,
    lineTotal: 2_500_000,
  },
];

/** What `create_order_with_items` returns: the order row plus its item rows. */
function rpcResponse() {
  return {
    order: {
      id: ORDER_ID,
      order_number: 'YM-2026-0042',
      user_id: null,
      customer_name: newOrder.customerName,
      email: newOrder.email,
      phone: newOrder.phone,
      delivery_address: newOrder.deliveryAddress,
      delivery_city: newOrder.deliveryCity,
      delivery_notes: newOrder.deliveryNotes,
      subtotal: 45000,
      delivery_fee: 2500,
      total: 47500,
      status: 'pending',
      created_at: '2026-10-01T22:30:00+00:00',
      updated_at: '2026-10-01T22:30:00+00:00',
    },
    items: newItems.map((item, index) => ({
      id: ITEM_IDS[index],
      order_id: ORDER_ID,
      product_id: item.productId,
      product_name: item.productName,
      product_slug: item.productSlug,
      product_image_url: item.productImageUrl,
      unit_price: item.unitPrice / 100,
      quantity: item.quantity,
      line_total: item.lineTotal / 100,
    })),
  };
}

interface RpcCall {
  name: string;
  params: Record<string, unknown>;
}

/**
 * A Supabase client that records `rpc()` calls and FAILS LOUDLY on any table
 * access. If someone reintroduces a plain PostgREST insert here, the test fails
 * with "Unexpected PostgREST table access" instead of silently passing.
 */
function fakeClient(response: {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}) {
  const rpcCalls: RpcCall[] = [];
  const client = {
    rpc(name: string, params: Record<string, unknown>) {
      rpcCalls.push({ name, params });
      return Promise.resolve({
        data: response.data ?? null,
        error: response.error ?? null,
      });
    },
    from(table: string): never {
      throw new Error(`Unexpected PostgREST table access: ${table}`);
    },
  };
  return { client: client as unknown as SupabaseClient, rpcCalls };
}

function orderRepo(response?: Parameters<typeof fakeClient>[0]) {
  const { client, rpcCalls } = fakeClient(response ?? { data: rpcResponse() });
  return {
    rpcCalls,
    orders: createSupabaseRepositories(client).orders,
  };
}

/**
 * Everything that is deterministic across both backends.
 *
 * Generated identifiers are deliberately excluded — each backend mints its own
 * UUIDs — but the *invariant* that matters is kept: every line item belongs to
 * the order it was created with.
 */
function contractOf(order: OrderRow, items: OrderItemRow[]) {
  return {
    order: {
      customerName: order.customerName,
      email: order.email,
      phone: order.phone,
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity,
      deliveryNotes: order.deliveryNotes,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      status: order.status,
    },
    items: items.map((item) => ({
      belongsToOrder: item.orderId === order.id,
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      productImageUrl: item.productImageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
  };
}

describe('SupabaseOrderRepository.create', () => {
  it('creates the order through the create_order_with_items RPC, never a nested PostgREST insert', async () => {
    const { orders, rpcCalls } = orderRepo();

    await orders.create({ order: newOrder, items: newItems });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe('create_order_with_items');
    // `from()` throws, so reaching this assertion at all proves no table insert
    // was attempted — the exact shape that returned PGRST204 in production.
  });

  it('sends every line item, preserving order and snapshot fields', async () => {
    const { orders, rpcCalls } = orderRepo();

    await orders.create({ order: newOrder, items: newItems });

    expect(rpcCalls[0].params.p_items).toEqual([
      {
        product_id: PRODUCT_IDS[0],
        product_name: 'Chocolate Delight Cake',
        product_slug: 'chocolate-delight-cake',
        product_image_url: '/images/catalog/chocolate-delight-cake.jpg',
        unit_price: '22500.00',
        quantity: 2,
        line_total: '45000.00',
      },
      {
        product_id: PRODUCT_IDS[1],
        product_name: 'Stand Mixer',
        product_slug: 'stand-mixer',
        product_image_url: null,
        unit_price: '25000.00',
        quantity: 1,
        line_total: '25000.00',
      },
    ]);
  });

  it('converts money to 2-decimal major units and omits order_number', async () => {
    const { orders, rpcCalls } = orderRepo();

    await orders.create({ order: newOrder, items: newItems });

    const params = rpcCalls[0].params;
    expect(params.p_subtotal).toBe('45000.00');
    expect(params.p_delivery_fee).toBe('2500.00');
    expect(params.p_total).toBe('47500.00');
    // The Postgres default calls next_order_number(); sending one would risk a
    // collision under concurrent checkouts.
    expect(params).not.toHaveProperty('order_number');
  });

  it('maps the RPC response back to the integer-kobo application contract', async () => {
    const { orders } = orderRepo();

    const created = await orders.create({ order: newOrder, items: newItems });

    expect(created.order.id).toBe(ORDER_ID);
    expect(created.order.orderNumber).toBe('YM-2026-0042');
    expect(created.order.total).toBe(4_750_000);
    expect(created.order.deliveryFee).toBe(250_000);
    expect(created.order.subtotal).toBe(4_500_000);
    expect(created.items).toHaveLength(2);
    expect(created.items[0]).toMatchObject({
      id: ITEM_IDS[0],
      orderId: ORDER_ID,
      productName: 'Chocolate Delight Cake',
      unitPrice: 2_250_000,
      quantity: 2,
      lineTotal: 4_500_000,
    });
  });

  it('produces the same shape as the in-memory repository', async () => {
    const { orders } = orderRepo();
    const memory = await createMemoryRepositories({ seed: true });

    const fromSupabase = await orders.create({ order: newOrder, items: newItems });
    const fromMemory = await memory.orders.create({ order: newOrder, items: newItems });

    expect(contractOf(fromSupabase.order, fromSupabase.items)).toEqual(
      contractOf(fromMemory.order, fromMemory.items),
    );
  });

  it('tolerates a response with no items rather than returning undefined', async () => {
    const response = rpcResponse();
    const { orders } = orderRepo({ data: { order: response.order } });

    const created = await orders.create({ order: newOrder, items: newItems });

    expect(created.items).toEqual([]);
  });

  it('surfaces a Postgres error instead of silently returning a partial order', async () => {
    const { orders } = orderRepo({
      data: null,
      error: {
        message: 'null value in column "product_name" violates not-null constraint',
        code: '23502',
      },
    });

    await expect(orders.create({ order: newOrder, items: newItems })).rejects.toThrow(
      /create order failed/,
    );
  });
});
