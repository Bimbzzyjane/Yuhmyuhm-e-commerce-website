import { Router } from 'express';
import type { CartService } from '../services/cart.service';
import { UnauthorizedError } from '../utils/errors';
import { parseOrThrow } from '../utils/validation';
import {
  AddCartItemSchema,
  CartItemParamsSchema,
  MergeCartSchema,
  UpdateCartItemSchema,
} from './schemas';

/**
 * Cart endpoints.
 *
 * Identity comes exclusively from `req.cartOwner`, which the auth and
 * cart-owner middleware derive from a verified token or the `X-Guest-Cart-Id`
 * header. No endpoint accepts an owner id in its payload.
 *
 * Every response returns the FULL cart DTO, so the client never has to
 * guess what changed — it just replaces its state with what came back.
 */
export function createCartRouter(cart: CartService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json({ data: await cart.getCart(req.cartOwner) });
  });

  router.post('/items', async (req, res) => {
    const body = parseOrThrow(AddCartItemSchema, req.body, 'Cart item');
    res.status(201).json({
      data: await cart.addItem(req.cartOwner, body.productId, body.quantity),
    });
  });

  router.patch('/items/:itemId', async (req, res) => {
    const { itemId } = parseOrThrow(CartItemParamsSchema, req.params, 'Cart item id');
    const body = parseOrThrow(UpdateCartItemSchema, req.body, 'Cart item update');
    res.json({ data: await cart.updateItem(req.cartOwner, itemId, body.quantity) });
  });

  router.delete('/items/:itemId', async (req, res) => {
    const { itemId } = parseOrThrow(CartItemParamsSchema, req.params, 'Cart item id');
    res.json({ data: await cart.removeItem(req.cartOwner, itemId) });
  });

  router.delete('/', async (req, res) => {
    res.json({ data: await cart.clearCart(req.cartOwner) });
  });

  /**
   * Folds a guest cart into the signed-in shopper's cart.
   * Requires authentication: merging is always *into* an account, never
   * between two anonymous carts.
   */
  router.post('/merge', async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('Sign in before merging a cart.');
    }
    const body = parseOrThrow(MergeCartSchema, req.body, 'Cart merge');
    res.json({ data: await cart.mergeGuestCart(req.user.id, body.guestCartId) });
  });

  return router;
}
