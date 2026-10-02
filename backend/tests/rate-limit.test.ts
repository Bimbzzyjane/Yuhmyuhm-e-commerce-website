import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env';
import { createTestContext, findProductBySlug, type TestContext } from './helpers/test-app';

/**
 * Rate limiting.
 *
 * The middlewares are NOT disabled under test — see `middleware/rate-limit.ts`.
 * The shared harness lifts both budgets out of the way so the rest of the suite
 * is unaffected; here they are deliberately set to single digits so a real 429
 * can be asserted.
 *
 * Two properties matter and are easy to get wrong together:
 *
 *   1. the dedicated checkout limiter must actually fire, and must NOT touch
 *      ordinary browsing; and
 *   2. `trust proxy` must match the real topology, because if a hop is trusted
 *      that does not exist then `X-Forwarded-For` becomes a dial for unlimited
 *      fresh buckets and the limiter can be bypassed with one header.
 */

const CUSTOMER = {
  name: 'Rate Limit Tester',
  email: 'ratelimit@example.com',
  phone: '08030000000',
  address: '1 Test Close',
  city: 'Lagos',
};

/** Seeds a fresh guest cart through the public API and returns its token. */
async function seedGuestCart(ctx: TestContext, quantity = 1): Promise<string> {
  const token = randomUUID();
  const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

  await ctx.api
    .post('/api/cart/items')
    .set('X-Guest-Cart-Id', token)
    .send({ productId: product.id, quantity })
    .expect(201);

  return token;
}

/**
 * Places one real guest order; the caller asserts the status.
 *
 * Deliberately NOT `async`: it must hand back supertest's chainable `Test`
 * (which only runs when awaited) rather than wrap it in a promise. The token
 * is always awaited by the caller first, so no request is built before another
 * has settled.
 */
function placeOrder(ctx: TestContext, token: string) {
  return ctx.api.post('/api/orders').set('X-Guest-Cart-Id', token).send({ customer: CUSTOMER });
}

describe('the dedicated checkout limiter', () => {
  it('allows the configured number of guest orders, then returns a structured 429', async () => {
    const ctx = await createTestContext({ CHECKOUT_RATE_LIMIT_MAX_REQUESTS: '3' });

    // Three genuine guest checkouts — the limit must not get in a real
    // shopper's way, and checkout itself must keep working unchanged.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await seedGuestCart(ctx);
      await placeOrder(ctx, token).expect(201);
    }

    const token = await seedGuestCart(ctx);
    const blocked = await placeOrder(ctx, token).expect(429);

    // Same envelope as every other failure the API returns.
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.message).toBeTruthy();
    expect(blocked.headers.ratelimit).toMatch(/limit=3/);
  });

  it('rejects before any side effect, leaving the cart untouched', async () => {
    const ctx = await createTestContext({ CHECKOUT_RATE_LIMIT_MAX_REQUESTS: '1' });

    const first = await seedGuestCart(ctx);
    await placeOrder(ctx, first).expect(201);

    const second = await seedGuestCart(ctx);
    await placeOrder(ctx, second).expect(429);

    // A throttled checkout must not have consumed the cart.
    const cart = await ctx.api.get('/api/cart').set('X-Guest-Cart-Id', second).expect(200);
    expect(cart.body.data.itemCount).toBe(1);
  });

  it('does not throttle browsing or cart requests', async () => {
    const ctx = await createTestContext({ CHECKOUT_RATE_LIMIT_MAX_REQUESTS: '1' });

    // Exhaust the checkout budget...
    const token = await seedGuestCart(ctx);
    await placeOrder(ctx, token).expect(201);
    const second = await seedGuestCart(ctx);
    await placeOrder(ctx, second).expect(429);

    // ...the catalogue is served by different routes and is unaffected.
    for (let i = 0; i < 5; i += 1) {
      await ctx.api.get('/api/products').expect(200);
      await ctx.api.get('/api/categories').expect(200);
      await ctx.api.get('/api/cart').set('X-Guest-Cart-Id', second).expect(200);
    }
  });
});

describe('the global limiter', () => {
  it('still protects every endpoint, not just checkout', async () => {
    const ctx = await createTestContext({ RATE_LIMIT_MAX_REQUESTS: '3' });

    await ctx.api.get('/api/products').expect(200);
    await ctx.api.get('/api/products').expect(200);
    await ctx.api.get('/api/products').expect(200);

    const blocked = await ctx.api.get('/api/products').expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('trust proxy configuration', () => {
  it('defaults to a single trusted hop', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).trustProxyHops).toBe(1);
  });

  it('accepts 0, because a directly exposed API must be able to trust nothing', () => {
    expect(loadConfig({ NODE_ENV: 'test', TRUST_PROXY_HOPS: '0' }).trustProxyHops).toBe(0);
  });

  it('rejects an unbounded hop count so a typo cannot trust every hop', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', TRUST_PROXY_HOPS: '99' })).toThrow(
      /TRUST_PROXY_HOPS/,
    );
  });

  it('ignores X-Forwarded-For when no hop is trusted, so the header cannot bypass the limit', async () => {
    const ctx = await createTestContext({
      RATE_LIMIT_MAX_REQUESTS: '2',
      TRUST_PROXY_HOPS: '0',
    });

    // Each request claims a different client address. Were the header trusted,
    // every request would open its own bucket and the limit would never fire.
    await ctx.api.get('/api/products').set('X-Forwarded-For', '203.0.113.1').expect(200);
    await ctx.api.get('/api/products').set('X-Forwarded-For', '203.0.113.2').expect(200);

    const blocked = await ctx.api
      .get('/api/products')
      .set('X-Forwarded-For', '203.0.113.3')
      .expect(429);

    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('honours X-Forwarded-For when exactly one hop is trusted', async () => {
    const ctx = await createTestContext({
      RATE_LIMIT_MAX_REQUESTS: '2',
      TRUST_PROXY_HOPS: '1',
    });

    // Proves the configured hop count really reaches Express: the forwarded
    // address is used as the client, so one shopper exhausting their budget
    // does not lock out the shopper behind them.
    await ctx.api.get('/api/products').set('X-Forwarded-For', '203.0.113.7').expect(200);
    await ctx.api.get('/api/products').set('X-Forwarded-For', '203.0.113.7').expect(200);
    await ctx.api.get('/api/products').set('X-Forwarded-For', '203.0.113.7').expect(429);

    await ctx.api.get('/api/products').set('X-Forwarded-For', '198.51.100.9').expect(200);
  });
});
