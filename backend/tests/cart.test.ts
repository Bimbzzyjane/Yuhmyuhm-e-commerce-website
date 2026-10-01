import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, findProductBySlug, type TestContext } from './helpers/test-app';

/**
 * Prices from the seed data, in kobo.
 * Delivery is ₦5,000 and becomes free at ₦150,000.
 */
const CHOCOLATE_CAKE = 4_500_000;
const PIPING_TIPS = 1_850_000;
const DELIVERY_FEE = 500_000;
const FREE_DELIVERY_THRESHOLD = 15_000_000;

describe('cart', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it('creates a guest cart and hands back the token to persist', async () => {
    const response = await ctx.api.get('/api/cart').expect(200);

    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.itemCount).toBe(0);
    expect(response.body.data.total).toBe(0);
    // Zero delivery on an empty cart — we do not charge to deliver nothing.
    expect(response.body.data.deliveryFee).toBe(0);
    expect(response.body.data.guestToken).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('replays the same cart when the guest token is sent', async () => {
    const first = await ctx.api.get('/api/cart').expect(200);
    const token = first.body.data.guestToken as string;
    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: product.id })
      .expect(201);

    const second = await ctx.api.get('/api/cart').set('X-Guest-Cart-Id', token).expect(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.itemCount).toBe(1);
  });

  it('keeps separate guest carts isolated from each other', async () => {
    const tokenA = randomUUID();
    const tokenB = randomUUID();
    const product = await findProductBySlug(ctx.repositories, 'lemon-drizzle-loaf');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', tokenA)
      .send({ productId: product.id, quantity: 3 })
      .expect(201);

    const cartB = await ctx.api.get('/api/cart').set('X-Guest-Cart-Id', tokenB).expect(200);
    expect(cartB.body.data.itemCount).toBe(0);
  });

  it('adds an item and prices it from the catalogue', async () => {
    const token = randomUUID();
    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

    const response = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    const cart = response.body.data;
    expect(cart.itemCount).toBe(1);
    expect(cart.subtotal).toBe(CHOCOLATE_CAKE);
    expect(cart.deliveryFee).toBe(DELIVERY_FEE);
    expect(cart.total).toBe(CHOCOLATE_CAKE + DELIVERY_FEE);
    expect(cart.items[0].unitPriceLabel).toBe('₦45,000');
    expect(cart.items[0].lineTotal).toBe(CHOCOLATE_CAKE);
  });

  it('increments the line instead of duplicating it when the same product is added twice', async () => {
    const token = randomUUID();
    const product = await findProductBySlug(ctx.repositories, 'lemon-drizzle-loaf');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    const response = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: product.id, quantity: 2 })
      .expect(201);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].quantity).toBe(3);
    expect(response.body.data.itemCount).toBe(3);
  });

  it('drops the delivery fee once the free-delivery threshold is reached', async () => {
    const token = randomUUID();
    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

    const response = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: product.id, quantity: 4 })
      .expect(201);

    const cart = response.body.data;
    expect(cart.subtotal).toBe(4 * CHOCOLATE_CAKE);
    expect(cart.subtotal).toBeGreaterThanOrEqual(FREE_DELIVERY_THRESHOLD);
    expect(cart.deliveryFee).toBe(0);
    expect(cart.qualifiesForFreeDelivery).toBe(true);
    expect(cart.total).toBe(cart.subtotal);
  });

  it('updates a line quantity and reprices the cart', async () => {
    const token = randomUUID();
    const product = await findProductBySlug(ctx.repositories, 'stainless-steel-chafing-dish');

    const added = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    const lineId = added.body.data.items[0].id as string;

    const updated = await ctx.api
      .patch(`/api/cart/items/${lineId}`)
      .set('X-Guest-Cart-Id', token)
      .send({ quantity: 2 })
      .expect(200);

    expect(updated.body.data.items[0].quantity).toBe(2);
    expect(updated.body.data.subtotal).toBe(product.price * 2);
  });

  it('treats a quantity of 0 as a removal', async () => {
    const token = randomUUID();
    const product = await findProductBySlug(ctx.repositories, 'professional-cake-turntable');

    const added = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: product.id, quantity: 2 })
      .expect(201);

    const response = await ctx.api
      .patch(`/api/cart/items/${added.body.data.items[0].id}`)
      .set('X-Guest-Cart-Id', token)
      .send({ quantity: 0 })
      .expect(200);

    expect(response.body.data.items).toEqual([]);
  });

  it('removes a line and clears the whole cart', async () => {
    const token = randomUUID();
    const first = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');
    const second = await findProductBySlug(ctx.repositories, 'lemon-drizzle-loaf');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: first.id })
      .expect(201);

    const added = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: second.id })
      .expect(201);

    const removed = await ctx.api
      .delete(`/api/cart/items/${added.body.data.items[0].id}`)
      .set('X-Guest-Cart-Id', token)
      .expect(200);
    expect(removed.body.data.items).toHaveLength(1);

    const cleared = await ctx.api.delete('/api/cart').set('X-Guest-Cart-Id', token).expect(200);
    expect(cleared.body.data.items).toEqual([]);
    expect(cleared.body.data.subtotal).toBe(0);
  });

  it('rejects an out-of-stock product with OUT_OF_STOCK', async () => {
    const token = randomUUID();
    const soldOut = await findProductBySlug(ctx.repositories, 'edible-gold-leaf-pack');
    expect(soldOut.stockQuantity).toBe(0);

    const response = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: soldOut.id, quantity: 1 })
      .expect(409);

    expect(response.body.error.code).toBe('OUT_OF_STOCK');
  });

  it('rejects a quantity larger than the available stock', async () => {
    const token = randomUUID();
    const scarce = await findProductBySlug(ctx.repositories, 'banquet-serving-trolley');

    const response = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: scarce.id, quantity: scarce.stockQuantity + 1 })
      .expect(409);

    expect(response.body.error.code).toBe('OUT_OF_STOCK');
    expect(response.body.error.details.available).toBe(scarce.stockQuantity);
  });

  it('404s for an unknown product and 400s for a malformed body', async () => {
    const token = randomUUID();

    const missing = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: randomUUID() })
      .expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const malformed = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: 'not-a-uuid', quantity: -5 })
      .expect(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not let one cart patch a line belonging to another', async () => {
    const owner = randomUUID();
    const intruder = randomUUID();
    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

    const added = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', owner)
      .send({ productId: product.id })
      .expect(201);

    const response = await ctx.api
      .patch(`/api/cart/items/${added.body.data.items[0].id}`)
      .set('X-Guest-Cart-Id', intruder)
      .send({ quantity: 5 })
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('sums several lines in integer kobo without floating point drift', async () => {
    const token = randomUUID();
    const cake = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');
    const tips = await findProductBySlug(ctx.repositories, 'stainless-piping-tip-set-24');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: cake.id, quantity: 1 })
      .expect(201);

    const response = await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: tips.id, quantity: 2 })
      .expect(201);

    expect(response.body.data.subtotal).toBe(CHOCOLATE_CAKE + PIPING_TIPS * 2);
    expect(Number.isInteger(response.body.data.subtotal)).toBe(true);
  });
});
