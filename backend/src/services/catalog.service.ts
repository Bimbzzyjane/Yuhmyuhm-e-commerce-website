import type { AppConfig } from '../config/env';
import type { CategoryWithCount, Paginated, Product } from '../domain/types';
import type { Repositories } from '../repositories/types';
import { NotFoundError } from '../utils/errors';
import { buildPagination, paginate, toCategoryDto, toProductDto } from './presenters';

export type ProductOrder = 'sortOrder' | 'priceAsc' | 'priceDesc' | 'newest';

export interface ListProductsInput {
  categorySlug?: string;
  search?: string;
  featured?: boolean;
  limit: number;
  offset: number;
  orderBy?: ProductOrder;
}

export interface CatalogServiceDeps {
  repositories: Repositories;
  config: AppConfig;
}

/**
 * Read-only catalogue access. Only active products are ever exposed here —
 * the `includeInactive` switch on the repository exists for future admin tools,
 * not for the storefront.
 */
export function createCatalogService({ repositories, config }: CatalogServiceDeps) {
  return {
    async listCategories(): Promise<CategoryWithCount[]> {
      const rows = await repositories.categories.listWithCounts({ activeOnly: true });
      return rows.map((row) => ({ ...toCategoryDto(row), productCount: row.productCount }));
    },

    async getCategory(categorySlug: string): Promise<CategoryWithCount> {
      const row = await repositories.categories.findBySlug(categorySlug);
      if (!row || !row.isActive) throw new NotFoundError('We could not find that collection.');

      const page = await repositories.products.list({
        categorySlug,
        limit: 1,
        offset: 0,
        includeInactive: false,
      });
      return { ...toCategoryDto(row), productCount: page.total };
    },

    async listProducts(input: ListProductsInput): Promise<Paginated<Product>> {
      const page = await repositories.products.list({ ...input, includeInactive: false });
      return paginate(
        page.rows.map((row) => toProductDto(row, config.currency)),
        buildPagination(page.total, input.limit, input.offset),
      );
    },

    async getProduct(idOrSlug: string): Promise<Product> {
      const row = await repositories.products.findByIdOrSlug(idOrSlug);
      if (!row || !row.isActive) throw new NotFoundError('We could not find that product.');
      return toProductDto(row, config.currency);
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
