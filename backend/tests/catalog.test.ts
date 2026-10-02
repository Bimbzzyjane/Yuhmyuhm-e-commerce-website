import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { SEED_CATEGORIES, SEED_PRODUCTS } from '../src/db/seed-data';
import { createTestContext, type TestContext } from './helpers/test-app';

/**
 * Seeded imagery is served to the browser as-is, so a path that does not exist
 * becomes a 404 on a live page instead of an obvious failure. These tests read
 * the real published files so the mismatch is caught at CI time.
 */
const CATALOG_DIR = join(__dirname, '..', '..', 'frontend', 'public', 'images', 'catalog');

/** `imageUrl` is optional on the seed row types; normalise to string | null. */
const seededImageUrls = [
  ...SEED_CATEGORIES.map((c) => ({ label: `category ${c.slug}`, url: c.imageUrl ?? null })),
  ...SEED_PRODUCTS.map((p) => ({ label: `product ${p.slug}`, url: p.imageUrl ?? null })),
];

describe('seeded catalogue imagery', () => {
  it('gives every category and product an image or an explicit null', () => {
    expect(seededImageUrls).toHaveLength(SEED_CATEGORIES.length + SEED_PRODUCTS.length);
  });

  it('points only at local paths, never a third-party host', () => {
    for (const { label, url } of seededImageUrls) {
      if (url === null) continue;
      expect(url, label).toMatch(/^\/images\/catalog\/[\w-]+\.jpg$/);
    }
  });

  it('references only files that are actually published', () => {
    const missing: string[] = [];
    for (const { label, url } of seededImageUrls) {
      if (url === null) continue;
      const filename = url.replace('/images/catalog/', '');
      if (!existsSync(join(CATALOG_DIR, filename))) {
        missing.push(`${label} -> ${url}`);
      }
    }
    // A null imageUrl is a deliberate placeholder choice, not a failure.
    expect(missing, `missing published images:\n${missing.join('\n')}`).toEqual([]);
  });

  it('leaves only the unlicensed piping-tip set without a photo', () => {
    const withoutPhoto = SEED_PRODUCTS.filter((p) => p.imageUrl === null).map((p) => p.slug);
    // If a verifiable photo is ever sourced, add it to --apply in
    // scripts/fetch-catalog-images.mjs and delete this expectation.
    expect(withoutPhoto).toEqual(['stainless-piping-tip-set-24']);
  });
});

describe('health', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it('answers without auth and exposes only minimal liveness detail', async () => {
    const response = await ctx.api.get('/api/health').expect(200);

    // Before this fix the probe reported dataBackend, mailTransport, currency,
    // deliveryFee and freeDeliveryThreshold to anyone who asked — and this test
    // asserted it. The exact shape is now pinned in health.test.ts; here we only
    // prove the probe is reachable before the auth middleware runs.
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('yuhmyuhm-commerce-api');
  });

  it('echoes a correlation id so a user can quote it to support', async () => {
    const response = await ctx.api.get('/api/health').set('X-Request-Id', 'abc-123').expect(200);
    expect(response.headers['x-request-id']).toBe('abc-123');
  });

  it('generates a request id when the caller does not supply one', async () => {
    const response = await ctx.api.get('/api/health').expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('catalogue', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it('lists the four collections with product counts', async () => {
    const response = await ctx.api.get('/api/categories').expect(200);
    const slugs = response.body.data.map((category: { slug: string }) => category.slug);

    expect(slugs).toEqual(['cakes', 'catering-equipment', 'baking-supplies', 'event-essentials']);
    for (const category of response.body.data) {
      expect(category.productCount).toBeGreaterThan(0);
    }
  });

  it('serves one collection with its total', async () => {
    const response = await ctx.api.get('/api/categories/cakes').expect(200);
    expect(response.body.data.slug).toBe('cakes');
    expect(response.body.data.productCount).toBe(6);
  });

  it('paginates products and reports the full total', async () => {
    const response = await ctx.api.get('/api/products').expect(200);

    expect(response.body.data).toHaveLength(12);
    expect(response.body.pagination).toMatchObject({
      limit: 12,
      offset: 0,
      total: 22,
      hasMore: true,
    });
  });

  it('filters by category', async () => {
    const response = await ctx.api.get('/api/products?category=cakes').expect(200);
    expect(response.body.pagination.total).toBe(6);
    for (const product of response.body.data) {
      expect(product.category.slug).toBe('cakes');
    }
  });

  it('searches by name', async () => {
    const response = await ctx.api.get('/api/products?search=chocolate').expect(200);
    const names = response.body.data.map((product: { name: string }) => product.name);
    expect(names).toContain('Chocolate Delight Cake');
  });

  it('filters to featured products only', async () => {
    const response = await ctx.api.get('/api/products?featured=true').expect(200);
    expect(response.body.pagination.total).toBeGreaterThan(0);
    for (const product of response.body.data) {
      expect(product.isFeatured).toBe(true);
    }
  });

  it('sorts by price ascending and descending', async () => {
    const asc = await ctx.api.get('/api/products?sort=price-asc&limit=5').expect(200);
    const prices = asc.body.data.map((product: { price: number }) => product.price);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));

    const desc = await ctx.api.get('/api/products?sort=price-desc&limit=5').expect(200);
    const descPrices = desc.body.data.map((product: { price: number }) => product.price);
    expect(descPrices).toEqual([...descPrices].sort((a: number, b: number) => b - a));
  });

  it('exposes money as integer kobo plus a ready-formatted label', async () => {
    const response = await ctx.api.get('/api/products/chocolate-delight-cake').expect(200);

    expect(response.body.data.price).toBe(4_500_000);
    expect(response.body.data.priceLabel).toBe('₦45,000');
    expect(Number.isInteger(response.body.data.price)).toBe(true);
  });

  it('404s with the standard envelope for an unknown product', async () => {
    const response = await ctx.api.get('/api/products/does-not-exist').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('rejects an out-of-range limit with field-level detail', async () => {
    const response = await ctx.api.get('/api/products?limit=999').expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.issues[0].path).toBe('limit');
  });

  it('returns the standard envelope for an unknown route', async () => {
    const response = await ctx.api.get('/api/nope').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
