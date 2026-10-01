import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  findProductBySlug,
  testAuthUserId,
  testToken,
  type TestContext,
} from './helpers/test-app';

describe('authentication', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  it('rejects an unauthenticated profile request', async () => {
    const response = await ctx.api.get('/api/auth/me').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token the verifier does not accept', async () => {
    const response = await ctx.api
      .get('/api/auth/me')
      .set('Authorization', 'Bearer total-nonsense')
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates the local profile on first sign-in', async () => {
    const token = testToken(testAuthUserId(7), 'newcomer@example.com', 'New Comer');

    const response = await ctx.api
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.email).toBe('newcomer@example.com');
    expect(response.body.data.fullName).toBe('New Comer');
    expect(response.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.data.authUserId).toBe(testAuthUserId(7));
  });

  it('is idempotent: repeat sign-ins reuse the same profile row', async () => {
    const token = testToken(testAuthUserId(8), 'repeat@example.com', 'Repeat');

    const first = await ctx.api
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const second = await ctx.api
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('re-links one profile when the same email returns via another provider', async () => {
    // The realistic case this guards: someone signs up with an email and
    // password, then later chooses "Continue with Google" with the same address.
    // Supabase gives them a different auth id, but they are the same person and
    // must keep the same cart and order history.
    const emailPassword = testToken(testAuthUserId(11), 'same@example.com', 'Same Person');
    const google = testToken(testAuthUserId(12), 'same@example.com', 'Same Person');

    const first = await ctx.api
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${emailPassword}`)
      .expect(200);

    const second = await ctx.api
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${google}`)
      .expect(200);

    // Same profile row (so the same cart), now pointing at the new auth id.
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.authUserId).toBe(testAuthUserId(12));
    expect(second.body.data.email).toBe('same@example.com');
  });

  it('keeps a signed-in shopper cart separate from any guest cart', async () => {
    const bearer = testToken(testAuthUserId(9), 'shopper@example.com');
    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', randomUUID())
      .send({ productId: product.id, quantity: 4 })
      .expect(201);

    const signedIn = await ctx.api
      .get('/api/cart')
      .set('Authorization', `Bearer ${bearer}`)
      .expect(200);

    expect(signedIn.body.data.items).toEqual([]);
    expect(signedIn.body.data.guestToken).toBeNull();
    expect(signedIn.body.data.userId).toBeTruthy();
  });
});

describe('guest cart merge on sign-in', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  it('sums quantities instead of overwriting them', async () => {
    const guestToken = randomUUID();
    const bearer = testToken(testAuthUserId(1), 'ada@example.com', 'Ada Obi');
    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

    // Guest adds two cakes before signing in.
    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', guestToken)
      .send({ productId: product.id, quantity: 2 })
      .expect(201);

    // The account already had one cake in its own cart.
    await ctx.api
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    const merged = await ctx.api
      .post('/api/cart/merge')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ guestCartId: guestToken })
      .expect(200);

    expect(merged.body.data.items).toHaveLength(1);
    expect(merged.body.data.items[0].quantity).toBe(3);
    expect(merged.body.data.subtotal).toBe(3 * product.price);
  });

  it('preserves a guest cart that had no matching account cart', async () => {
    const guestToken = randomUUID();
    const bearer = testToken(testAuthUserId(2), 'late@example.com');
    const product = await findProductBySlug(ctx.repositories, 'lemon-drizzle-loaf');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', guestToken)
      .send({ productId: product.id, quantity: 2 })
      .expect(201);

    const merged = await ctx.api
      .post('/api/cart/merge')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ guestCartId: guestToken })
      .expect(200);

    // The guest's items survive the transition onto the account.
    expect(merged.body.data.itemCount).toBe(2);
    expect(merged.body.data.items[0].product.slug).toBe('lemon-drizzle-loaf');
  });

  it('retires the guest cart so it cannot be merged twice', async () => {
    const guestToken = randomUUID();
    const bearer = testToken(testAuthUserId(3), 'twice@example.com');
    const product = await findProductBySlug(ctx.repositories, 'coconut-cream-cake');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', guestToken)
      .send({ productId: product.id, quantity: 2 })
      .expect(201);

    const first = await ctx.api
      .post('/api/cart/merge')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ guestCartId: guestToken })
      .expect(200);
    expect(first.body.data.itemCount).toBe(2);

    const second = await ctx.api
      .post('/api/cart/merge')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ guestCartId: guestToken })
      .expect(200);

    // Still 2 — not 4 — so a stale browser tab cannot double an order.
    expect(second.body.data.itemCount).toBe(2);
  });

  it('requires authentication to merge', async () => {
    const response = await ctx.api
      .post('/api/cart/merge')
      .send({ guestCartId: randomUUID() })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('validates the guest cart id', async () => {
    const bearer = testToken(testAuthUserId(4), 'validate@example.com');

    const response = await ctx.api
      .post('/api/cart/merge')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ guestCartId: 'not-a-uuid' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
