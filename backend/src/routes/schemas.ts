import { z } from 'zod';

/**
 * Request schemas.
 *
 * These are the contract at the edge of the API: every route parses its input
 * through one of these before any business logic runs, and the inferred types
 * are what the services receive. Validation errors come back as a 400 with all
 * field problems listed at once.
 */

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).default(12),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ProductListQuerySchema = PaginationQuerySchema.extend({
  category: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  /** `?featured=true` — kept as a string because query values always arrive as strings. */
  featured: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sort: z.enum(['featured', 'price-asc', 'price-desc', 'newest']).default('featured'),
});

export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export const SlugsParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

export const IdOrSlugParamsSchema = z.object({
  idOrSlug: z.string().trim().min(1).max(160),
});

export const AddCartItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const UpdateCartItemSchema = z.object({
  /** 0 removes the line — see cart.service.ts. */
  quantity: z.coerce.number().int().min(0).max(99),
});

export const CartItemParamsSchema = z.object({
  itemId: z.uuid(),
});

export const MergeCartSchema = z.object({
  guestCartId: z.uuid(),
});

export const CheckoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email(),
    phone: z.string().trim().min(7).max(30),
    address: z.string().trim().min(5).max(240),
    city: z.string().trim().min(2).max(80),
    notes: z.string().trim().max(500).optional(),
  }),
});

export const OrderParamsSchema = z.object({
  orderId: z.uuid(),
});
