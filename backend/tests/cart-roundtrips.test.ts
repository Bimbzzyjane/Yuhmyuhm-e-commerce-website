import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config/env';
import { createMemoryRepositories } from '../src/repositories/memory/memory-repositories';
import type { Repositories } from '../src/repositories/types';
import { CapturingMailer, createStubAuthVerifier, findProductBySlug } from './helpers/test-app';

/**
 * Add to Cart used to take eight SEQUENTIAL database round trips:
 *
 *   findById -> resolveCart -> listItems -> (select + write) -> touch
 *            -> listItems -> findManyByIds
 *
 * Against a remote Supabase project that is ~8 x 200ms of pure waiting. These
 * tests pin the two properties that keep it cheap:
 *
 *   1. the cart is listed exactly once per request, and the line is written
 *      with one upsert rather than a read-then-write pair; and
 *   2. the independent calls genuinely overlap, so the critical path is a
 *      few waves rather than the sum of every call.
 *
 * (2) is asserted by injecting a fixed delay into every repository call. The
 * wall-clock cost then measures WAVE COUNT rather than machine speed, which
 * makes the bound deterministic instead of flaky.
 */

const DELAY_MS = 40;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Spy {
  calls: Map<string, number>;
  /** Highest number of repository calls that were ever in flight at once. */
  peakConcurrency: number;
}

function instrument(inner: Repositories, delayMs: number, spy: Spy): Repositories {
  const wrap = <T extends object>(target: T, prefix: string): T =>
    new Proxy(target, {
      get(obj, prop) {
        const value = Reflect.get(obj, prop) as unknown;
        if (typeof value !== 'function') return value;

        return async (...args: unknown[]) => {
          const key = `${prefix}.${String(prop)}`;
          spy.calls.set(key, (spy.calls.get(key) ?? 0) + 1);

          inFlight += 1;
          if (inFlight > spy.peakConcurrency) spy.peakConcurrency = inFlight;
          try {
            if (delayMs > 0) await sleep(delayMs);
            return await (value as (...a: unknown[]) => unknown).apply(obj, args);
          } finally {
            inFlight -= 1;
          }
        };
      },
    }) as T;

  let inFlight = 0;

  return {
    categories: wrap(inner.categories, 'categories'),
    products: wrap(inner.products, 'products'),
    users: wrap(inner.users, 'users'),
    carts: wrap(inner.carts, 'carts'),
    orders: wrap(inner.orders, 'orders'),
  };
}

async function createHarness(delayMs = 0) {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    BACKEND_DATA_BACKEND: 'memory',
    MAIL_TRANSPORT: 'console',
  });
  const seed = await createMemoryRepositories({ seed: true });
  const spy: Spy = { calls: new Map(), peakConcurrency: 0 };

  const app = createApp({
    config,
    repositories: instrument(seed, delayMs, spy),
    mailer: new CapturingMailer(),
    authVerifier: createStubAuthVerifier(),
  });

  const totalCalls = () => [...spy.calls.values()].reduce((a, b) => a + b, 0);

  return { seed, spy, api: supertest(app), totalCalls };
}

describe('add to cart round trips', () => {
  it('lists the cart once and writes the line with a single upsert', async () => {
    const ctx = await createHarness();
    const cake = await findProductBySlug(ctx.seed, 'chocolate-delight-cake');

    const response = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', randomUUID())
      .send({ productId: cake.id, quantity: 2 })
      .expect(201);

    // The regression this guards: the old path read the cart twice.
    expect(ctx.spy.calls.get('carts.listItems')).toBe(1);
    // Read-then-write is gone; one atomic statement replaces both calls.
    expect(ctx.spy.calls.get('carts.addItem') ?? 0).toBe(0);
    expect(ctx.spy.calls.get('carts.upsertItem')).toBe(1);
    expect(ctx.spy.calls.get('products.findById')).toBe(1);
    expect(ctx.spy.calls.get('carts.touch')).toBe(1);

    // Behaviour is unchanged: server-side pricing, stock check and shape.
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.itemCount).toBe(2);
    expect(response.body.data.subtotal).toBe(2 * cake.price);
    expect(response.body.data.total).toBe(2 * cake.price + 500_000);
  });

  it('upserts the summed quantity, so a repeated add still accumulates', async () => {
    const ctx = await createHarness();
    const cake = await findProductBySlug(ctx.seed, 'chocolate-delight-cake');
    const token = randomUUID();

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: cake.id, quantity: 2 })
      .expect(201);

    const second = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: cake.id, quantity: 3 })
      .expect(201);

    expect(second.body.data.items).toHaveLength(1);
    expect(second.body.data.items[0].quantity).toBe(5);
    expect(second.body.data.subtotal).toBe(5 * cake.price);
  });

  it('keeps every other line priced and rendered correctly', async () => {
    const ctx = await createHarness();
    const cake = await findProductBySlug(ctx.seed, 'chocolate-delight-cake');
    const tips = await findProductBySlug(ctx.seed, 'stainless-piping-tip-set-24');
    const token = randomUUID();

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: tips.id, quantity: 1 })
      .expect(201);

    const response = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: cake.id, quantity: 1 })
      .expect(201);

    const ids = response.body.data.items.map((i: { product: { id: string } }) => i.product.id);
    expect([...ids].sort()).toEqual([cake.id, tips.id].sort());
    expect(response.body.data.itemCount).toBe(2);
    expect(response.body.data.subtotal).toBe(cake.price + tips.price);
  });

  it('does not create a cart when the product is unknown', async () => {
    const ctx = await createHarness();

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', randomUUID())
      .send({ productId: randomUUID() })
      .expect(404);

    // The product check still happens before the cart is created, so a 404
    // leaves no orphan row behind.
    expect(ctx.spy.calls.get('carts.create') ?? 0).toBe(0);
  });

  it('overlaps its independent calls instead of waiting on each one', async () => {
    const ctx = await createHarness(DELAY_MS);
    const cake = await findProductBySlug(ctx.seed, 'chocolate-delight-cake');
    const token = randomUUID();

    // Warm the cart so the request follows the cheapest path.
    await ctx.api.get('/api/cart').set('X-Guest-Cart-Id', token).expect(200);
    const before = ctx.totalCalls();

    const started = process.hrtime.bigint();
    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: cake.id, quantity: 1 })
      .expect(201);
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;

    expect(ctx.totalCalls() - before).toBe(6);

    // Six calls arranged in three waves of 40ms is ~120ms. Run strictly
    // sequentially they would cost 240ms, so this bound separates the two
    // designs decisively.
    expect(ctx.spy.peakConcurrency).toBeGreaterThan(1);
    expect(elapsed).toBeLessThan(DELAY_MS * 4);
  });
});
