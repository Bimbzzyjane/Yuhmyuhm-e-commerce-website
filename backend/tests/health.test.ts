import { beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers/test-app';

/**
 * `/api/health` is unauthenticated, so its response is a public API surface and
 * belongs under test like any other. These tests assert BOTH directions: the
 * shape we promise, and the absence of the internal configuration that used to
 * leak through it.
 *
 * Before this fix the probe reported `dataBackend`, `mailTransport`,
 * `currency`, `deliveryFee`, `freeDeliveryThreshold` and `environment` to
 * anyone who asked, telling an anonymous caller which datastore to attack and
 * handing out the shop's entire pricing policy.
 */

/** Every field the probe must never return to an anonymous caller. */
const FORBIDDEN_FIELDS = [
  'dataBackend',
  'mailTransport',
  'currency',
  'deliveryFee',
  'freeDeliveryThreshold',
  'environment',
  'env',
  'version',
  'timestamp',
  'port',
  'corsOrigins',
  'isProduction',
  'isTest',
  'supabase',
  'mail',
  'rateLimit',
  'checkoutRateLimit',
];

describe('GET /api/health', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // Non-default values on purpose: if a config field is ever reintroduced to
    // the body, the value is unmistakably identifiable instead of coinciding
    // with a default that a shape-only assertion would also accept.
    ctx = await createTestContext({
      BACKEND_DATA_BACKEND: 'memory',
      MAIL_TRANSPORT: 'console',
      CURRENCY: 'USD',
      DEFAULT_DELIVERY_FEE: '1234',
      FREE_DELIVERY_THRESHOLD: '999999',
    });
  });

  it('returns exactly status, service and uptimeSeconds', async () => {
    const response = await ctx.api.get('/api/health').expect(200);

    expect(Object.keys(response.body).sort()).toEqual(['service', 'status', 'uptimeSeconds']);
  });

  it('describes a live process in a machine-readable way', async () => {
    const response = await ctx.api.get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('yuhmyuhm-commerce-api');
    expect(typeof response.body.uptimeSeconds).toBe('number');
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it.each(FORBIDDEN_FIELDS)('never exposes %s to an anonymous caller', async (field) => {
    const response = await ctx.api.get('/api/health').expect(200);

    expect(response.body).not.toHaveProperty(field);
  });

  it('does not leak the configured values under any key name', async () => {
    const response = await ctx.api.get('/api/health').expect(200);
    const serialised = JSON.stringify(response.body);

    // A field could be renamed or nested and still leak the same facts, so the
    // values themselves are checked too — the pricing rules in particular.
    for (const value of ['USD', '1234', '999999', 'memory', 'console', 'development']) {
      expect(serialised).not.toContain(value);
    }
  });
});
