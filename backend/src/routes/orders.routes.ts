import { Router, type RequestHandler } from 'express';
import type { OrderService } from '../services/order.service';
import { UnauthorizedError } from '../utils/errors';
import { parseOrThrow } from '../utils/validation';
import { CheckoutSchema, OrderParamsSchema } from './schemas';

/**
 * Order endpoints.
 *
 * `POST /api/orders` accepts BOTH guest and signed-in checkouts — a shopper
 * should never be forced to create an account to buy a cake. When the caller
 * is anonymous the order is stored with `user_id = null` and the cart is
 * identified by the guest token.
 *
 * No price ever comes from the request body; only the customer's contact and
 * delivery details do.
 */
export function createOrdersRouter(deps: {
  orders: OrderService;
  requireUser: RequestHandler;
}): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const body = parseOrThrow(CheckoutSchema, req.body, 'Checkout details');

    const order = await deps.orders.placeOrder({
      owner: req.cartOwner,
      user: req.user,
      customer: body.customer,
    });

    res.status(201).json({ data: order });
  });

  router.get('/', deps.requireUser, async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('Sign in to view your orders.');
    }
    res.json({ data: await deps.orders.listOrders(req.user) });
  });

  router.get('/:orderId', deps.requireUser, async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('Sign in to view this order.');
    }
    const { orderId } = parseOrThrow(OrderParamsSchema, req.params, 'Order id');
    res.json({ data: await deps.orders.getOrder(req.user, orderId) });
  });

  return router;
}
