import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  findProductBySlug,
  testAuthUserId,
  testToken,
  type TestContext,
} from './helpers/test-app';

const CHOCOLATE_CAKE = 4_500_000;
const DELIVERY_FEE = 500_000;

const CUSTOMER = {
  name: 'Ada Obi',
  email: 'ada@example.com',
  phone: '08031234567',
  address: '12 Marina Road, Lagos Island',
  city: 'Lagos',
};

describe('checkout and orders', () => {
  let ctx: TestContext;

  // A fresh, isolated API + database per test: orders and stock are stateful,
  // so sharing a context would make the assertions order-dependent.
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  async function seedGuestCart(quantity = 2): Promise<string> {
    const token = randomUUID();
    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: product.id, quantity })
      .expect(201);

    return token;
  }

  it('places a guest order without requiring an account', async () => {
    const token = await seedGuestCart(2);

    const response = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({ customer: CUSTOMER })
      .expect(201);

    const order = response.body.data;
    expect(order.userId).toBeNull();
    expect(order.customerName).toBe(CUSTOMER.name);
    expect(order.status).toBe('pending');
    expect(order.items).toHaveLength(1);
    expect(order.itemCount).toBe(2);
    expect(order.subtotal).toBe(2 * CHOCOLATE_CAKE);
    expect(order.deliveryFee).toBe(DELIVERY_FEE);
    expect(order.total).toBe(2 * CHOCOLATE_CAKE + DELIVERY_FEE);
  });

  it('issues a human-readable, unique order number', async () => {
    // Seeded before either request is constructed: supertest starts its
    // ephemeral listener when the request object is created, so building one
    // and then awaiting another request in the same chain is a race.
    const firstToken = await seedGuestCart(1);
    const secondToken = await seedGuestCart(1);

    const first = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', firstToken)
      .send({ customer: CUSTOMER })
      .expect(201);

    const second = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', secondToken)
      .send({ customer: CUSTOMER })
      .expect(201);

    expect(first.body.data.orderNumber).toMatch(/^YM-\d{4}-\d{4}$/);
    expect(second.body.data.orderNumber).not.toBe(first.body.data.orderNumber);
  });

  it('empties the cart once the order is placed', async () => {
    const token = await seedGuestCart(2);

    await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({ customer: CUSTOMER })
      .expect(201);

    const cart = await ctx.api.get('/api/cart').set('X-Guest-Cart-Id', token).expect(200);
    expect(cart.body.data.items).toEqual([]);
    expect(cart.body.data.itemCount).toBe(0);
  });

  it('recomputes every total from the catalogue, ignoring client-supplied prices', async () => {
    const token = await seedGuestCart(2);

    const response = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({
        customer: CUSTOMER,
        // A hostile payload: none of these may influence the order.
        subtotal: 1,
        total: 1,
        deliveryFee: 0,
        items: [{ unitPrice: 1, quantity: 999 }],
      })
      .expect(201);

    const order = response.body.data;
    expect(order.subtotal).toBe(2 * CHOCOLATE_CAKE);
    expect(order.deliveryFee).toBe(DELIVERY_FEE);
    expect(order.total).toBe(2 * CHOCOLATE_CAKE + DELIVERY_FEE);
    expect(order.items[0].unitPrice).toBe(CHOCOLATE_CAKE);
  });

  it('freezes product name and price into the order line', async () => {
    const token = await seedGuestCart(1);
    const response = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({ customer: CUSTOMER })
      .expect(201);

    const line = response.body.data.items[0];
    expect(line.productName).toBe('Chocolate Delight Cake');
    expect(line.unitPrice).toBe(CHOCOLATE_CAKE);
    expect(line.unitPriceLabel).toBe('₦45,000');
    expect(line.lineTotalLabel).toBe('₦45,000');
  });

  it('decrements stock by the ordered quantity', async () => {
    const before = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');
    const token = await seedGuestCart(3);

    await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({ customer: CUSTOMER })
      .expect(201);

    const after = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');
    expect(after.stockQuantity).toBe(before.stockQuantity - 3);
  });

  it('emails the customer a confirmation carrying the order number and totals', async () => {
    const token = await seedGuestCart(2);
    const response = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({ customer: CUSTOMER })
      .expect(201);

    const orderNumber = response.body.data.orderNumber as string;
    const emails = ctx.mailer.receivedBy(CUSTOMER.email);

    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toContain(orderNumber);
    expect(emails[0].text).toContain(orderNumber);
    expect(emails[0].text).toContain('Chocolate Delight Cake');
    expect(emails[0].html).toContain(orderNumber);
    expect(emails[0].to.name).toBe(CUSTOMER.name);
  });

  it('escapes customer input in the confirmation email', async () => {
    const token = await seedGuestCart(1);
    await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({
        customer: { ...CUSTOMER, name: '<script>alert(1)</script>', notes: 'Deliver <b>early</b>' },
      })
      .expect(201);

    const html = ctx.mailer.receivedBy(CUSTOMER.email)[0].html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejects checkout when the cart is empty', async () => {
    const response = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', randomUUID())
      .send({ customer: CUSTOMER })
      .expect(400);

    expect(response.body.error.code).toBe('EMPTY_CART');
  });

  it('reports every missing customer field at once', async () => {
    const token = await seedGuestCart(1);
    const response = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({ customer: { name: 'A', email: 'not-an-email' } })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const paths = response.body.error.details.issues.map((issue: { path: string }) => issue.path);
    expect(paths).toContain('customer.name');
    expect(paths).toContain('customer.email');
    expect(paths).toContain('customer.phone');
    expect(paths).toContain('customer.address');
    expect(paths).toContain('customer.city');
  });

  it('attaches a signed-in order to the account and lists it back', async () => {
    const token = testToken(testAuthUserId(1), 'shopper@example.com', 'Ada Obi');

    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');
    await ctx.api
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    const placed = await ctx.api
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer: { ...CUSTOMER, email: 'shopper@example.com' } })
      .expect(201);

    expect(placed.body.data.userId).toBeTruthy();

    const list = await ctx.api
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(placed.body.data.id);

    const single = await ctx.api
      .get(`/api/orders/${placed.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(single.body.data.orderNumber).toBe(placed.body.data.orderNumber);
  });

  it('refuses to show one shopper another shopper order', async () => {
    const owner = testToken(testAuthUserId(1), 'owner@example.com', 'Owner');
    const stranger = testToken(testAuthUserId(2), 'stranger@example.com', 'Stranger');

    const product = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');
    await ctx.api
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${owner}`)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    const placed = await ctx.api
      .post('/api/orders')
      .set('Authorization', `Bearer ${owner}`)
      .send({ customer: CUSTOMER })
      .expect(201);

    const response = await ctx.api
      .get(`/api/orders/${placed.body.data.id}`)
      .set('Authorization', `Bearer ${stranger}`)
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
