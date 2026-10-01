import { Router } from 'express';
import type { CatalogService, ProductOrder } from '../services/catalog.service';
import { parseOrThrow } from '../utils/validation';
import { IdOrSlugParamsSchema, ProductListQuerySchema, SlugsParamsSchema } from './schemas';

const ORDER_BY: Record<string, ProductOrder> = {
  featured: 'sortOrder',
  'price-asc': 'priceAsc',
  'price-desc': 'priceDesc',
  newest: 'newest',
};

/**
 * Public catalogue endpoints.
 *
 * Handlers stay this thin on purpose: parse -> call the service -> send JSON.
 * Anything else belongs in the service layer.
 *
 * Errors are thrown, not caught: Express 5 forwards rejected promises from
 * async handlers to the error middleware, which owns the response envelope.
 */
export function createCatalogRouter(catalog: CatalogService): Router {
  const router = Router();

  router.get('/categories', async (_req, res) => {
    res.json({ data: await catalog.listCategories() });
  });

  router.get('/categories/:slug', async (req, res) => {
    const { slug } = parseOrThrow(SlugsParamsSchema, req.params, 'Category slug');
    res.json({ data: await catalog.getCategory(slug) });
  });

  router.get('/products', async (req, res) => {
    const query = parseOrThrow(ProductListQuerySchema, req.query, 'Product query');

    const result = await catalog.listProducts({
      categorySlug: query.category,
      search: query.search,
      featured: query.featured,
      limit: query.limit,
      offset: query.offset,
      orderBy: ORDER_BY[query.sort] ?? 'sortOrder',
    });

    res.json(result);
  });

  router.get('/products/:idOrSlug', async (req, res) => {
    const { idOrSlug } = parseOrThrow(IdOrSlugParamsSchema, req.params, 'Product id');
    res.json({ data: await catalog.getProduct(idOrSlug) });
  });

  return router;
}
