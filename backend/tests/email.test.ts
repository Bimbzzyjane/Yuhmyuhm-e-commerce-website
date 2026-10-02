import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MailConfig, loadConfig } from '../src/config/env';
import { createMailer, type EmailMessage, type EmailReceipt, type Mailer } from '../src/email';
import { ConsoleMailer } from '../src/email/console-mailer';
import { MailgunMailer } from '../src/email/mailgun-mailer';
import { createTestContext, findProductBySlug } from './helpers/test-app';

/**
 * The Mailgun transport and the rule that surrounds it: checkout must never
 * depend on email succeeding.
 *
 * `fetch` is stubbed throughout, so nothing here touches the network and no
 * real credential is ever needed. The API key below is a literal made for
 * these tests — it is not, and must not be, a real secret.
 */

const TEST_KEY = 'key-0000000000000000000000000000000000000000';
const DOMAIN = 'mg.example.com';

const mailConfig = (over: Partial<MailConfig> = {}): MailConfig => ({
  transport: 'mailgun',
  apiKey: TEST_KEY,
  domain: DOMAIN,
  apiBase: 'https://api.mailgun.net',
  fromName: 'Yuhmyuhm Catering Services',
  fromAddress: 'orders@example.com',
  orderNotificationTo: null,
  ...over,
});

const message: EmailMessage = {
  to: { address: 'ada@example.com', name: 'Ada Obi' },
  subject: 'Your Yuhmyuhm order YM-2026-0001',
  html: '<p>Thanks!</p>',
  text: 'Thanks!',
  replyTo: { address: 'orders@example.com', name: 'Yuhmyuhm Catering Services' },
};

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MailgunMailer', () => {
  it('posts to the documented messages endpoint with Basic auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: '<2026@mg>', message: 'Queued' }));
    vi.stubGlobal('fetch', fetchMock);

    const receipt = await new MailgunMailer(mailConfig()).send(message);

    expect(receipt).toEqual<EmailReceipt>({ id: '<2026@mg>' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.mailgun.net/v3/${DOMAIN}/messages`);
    expect(init.method).toBe('POST');
    const expected = Buffer.from(`api:${TEST_KEY}`).toString('base64');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${expected}`);
  });

  it('sends the message as multipart form data, not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: '<2026@mg>' }));
    vi.stubGlobal('fetch', fetchMock);

    await new MailgunMailer(mailConfig()).send(message);

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('from')).toBe('Yuhmyuhm Catering Services <orders@example.com>');
    expect(body.get('to')).toBe('Ada Obi <ada@example.com>');
    expect(body.get('subject')).toBe(message.subject);
    expect(body.get('text')).toBe(message.text);
    expect(body.get('html')).toBe(message.html);
    expect(body.get('h:Reply-To')).toBe('orders@example.com');
  });

  it('throws with the status and Mailgun message when the send is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ message: 'Missing recipients' }, 400)));

    await expect(new MailgunMailer(mailConfig()).send(message)).rejects.toThrow(
      /Mailgun rejected the message \(400\): Missing recipients/,
    );
  });

  it('never leaks the API key into an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ message: 'Forbidden' }, 401)));

    const error = await new MailgunMailer(mailConfig())
      .send(message)
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).message)).not.toContain(TEST_KEY);
    expect(JSON.stringify({ message: (error as Error).message })).not.toContain(TEST_KEY);
  });

  it('reports a network failure rather than silently succeeding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')));

    await expect(new MailgunMailer(mailConfig()).send(message)).rejects.toThrow('socket hang up');
  });

  it('honours the configured API base instead of assuming the US region', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: '<2026@mg>' }));
    vi.stubGlobal('fetch', fetchMock);

    await new MailgunMailer(mailConfig({ apiBase: 'https://api.eu.mailgun.net' })).send(message);

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe(
      `https://api.eu.mailgun.net/v3/${DOMAIN}/messages`,
    );
  });

  it('tolerates a trailing slash on the API base', () => {
    const config = loadConfig({
      MAIL_TRANSPORT: 'mailgun',
      MAILGUN_API_KEY: TEST_KEY,
      MAILGUN_DOMAIN: DOMAIN,
      MAILGUN_API_BASE: 'https://api.mailgun.net/',
    });
    expect(config.mail.apiBase).toBe('https://api.mailgun.net');
  });

  it('refuses to boot with mailgun selected but no credentials', () => {
    // Fail fast at startup rather than at the first checkout.
    expect(() => loadConfig({ MAIL_TRANSPORT: 'mailgun' })).toThrow(/MAILGUN_API_KEY/);
    expect(() => loadConfig({ MAIL_TRANSPORT: 'mailgun', MAILGUN_API_KEY: TEST_KEY })).toThrow(
      /MAILGUN_DOMAIN/,
    );
  });

  it('refuses to start without a key or domain', () => {
    expect(() => new MailgunMailer(mailConfig({ apiKey: null }))).toThrow(/MAILGUN_API_KEY/);
    expect(() => new MailgunMailer(mailConfig({ domain: null }))).toThrow(/MAILGUN_DOMAIN/);
  });
});

describe('transport selection', () => {
  it('keeps the console transport available for development and tests', () => {
    expect(createMailer(loadConfig({ MAIL_TRANSPORT: 'console' }))).toBeInstanceOf(ConsoleMailer);
    expect(createMailer(loadConfig({})).transport).toBe('console');
  });

  it('uses Mailgun when selected', () => {
    const config = loadConfig({
      MAIL_TRANSPORT: 'mailgun',
      MAILGUN_API_KEY: TEST_KEY,
      MAILGUN_DOMAIN: DOMAIN,
    });
    expect(createMailer(config)).toBeInstanceOf(MailgunMailer);
  });

  it('defaults the From name to the brand', () => {
    const config = loadConfig({
      MAIL_TRANSPORT: 'mailgun',
      MAILGUN_API_KEY: TEST_KEY,
      MAILGUN_DOMAIN: DOMAIN,
    });
    expect(config.mail.fromName).toBe('Yuhmyuhm Catering Services');
  });
});

/** A transport that always fails, standing in for a Mailgun outage. */
class BrokenMailer implements Mailer {
  readonly transport = 'mailgun' as const;
  readonly attempts: EmailMessage[] = [];

  async send(email: EmailMessage): Promise<EmailReceipt> {
    this.attempts.push(email);
    throw new Error('Mailgun rejected the message (429): Too many requests');
  }
}

describe('checkout is independent of the email transport', () => {
  const customer = {
    name: 'Ada Obi',
    email: 'ada@example.com',
    phone: '08031234567',
    address: '12 Marina Road, Lagos Island',
    city: 'Lagos',
  };

  async function seedCart(ctx: Awaited<ReturnType<typeof createTestContext>>, quantity = 2) {
    const token = randomUUID();
    const cake = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');
    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: cake.id, quantity })
      .expect(201);
    return token;
  }

  it('still creates the order when the mailer throws', async () => {
    const broken = new BrokenMailer();
    const ctx = await createTestContext({}, broken);
    const token = await seedCart(ctx, 2);

    const response = await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', token)
      .send({ customer })
      .expect(201);

    // The order exists and is usable...
    expect(response.body.data.orderNumber).toMatch(/^YM-\d{4}-\d{4}$/);
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.itemCount).toBe(2);

    // ...and it is durably stored, not just returned.
    const cake = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');
    expect(cake.stockQuantity).toBe(24 - 2);

    // The confirmation was attempted exactly once.
    expect(broken.attempts).toHaveLength(1);
    expect(broken.attempts[0].to.address).toBe(customer.email);
  });

  it('sends nothing when the order was never created', async () => {
    const broken = new BrokenMailer();
    const ctx = await createTestContext({}, broken);

    // Empty cart: the order cannot be created, so no email may be attempted.
    await ctx.api
      .post('/api/orders')
      .set('X-Guest-Cart-Id', randomUUID())
      .send({ customer })
      .expect(400);

    expect(broken.attempts).toHaveLength(0);
  });

  it('sends nothing when checkout is rejected as out of stock', async () => {
    const broken = new BrokenMailer();
    const ctx = await createTestContext({}, broken);
    const token = randomUUID();
    const cake = await findProductBySlug(ctx.repositories, 'chocolate-delight-cake');

    await ctx.api
      .post('/api/cart/items')
      .set('X-Guest-Cart-Id', token)
      .send({ productId: cake.id, quantity: 2 })
      .expect(201);

    // Something else sells the remaining stock between adding and checking
    // out, so the order is refused before it is ever stored.
    await ctx.repositories.products.decrementStock(cake.id, cake.stockQuantity);

    await ctx.api.post('/api/orders').set('X-Guest-Cart-Id', token).send({ customer }).expect(409);

    expect(broken.attempts).toHaveLength(0);
  });
});
