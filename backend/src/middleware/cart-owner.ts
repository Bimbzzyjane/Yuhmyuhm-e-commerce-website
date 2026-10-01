import type { RequestHandler } from 'express';

/**
 * Derives WHO owns the cart for this request.
 *
 * This is a security boundary, not a convenience: `req.cartOwner` is built only
 * from the verified user (set by the auth middleware) or the `X-Guest-Cart-Id`
 * header. Route handlers must never accept a `userId` or `cartId` from a
 * request body — that is how one shopper ends up reading another's cart.
 *
 * A signed-in caller never keeps a guest identity, which is what makes the
 * "merge on sign-in" step meaningful.
 */
export const resolveCartOwner: RequestHandler = (req, _res, next) => {
  const guestHeader = req.header('x-guest-cart-id')?.trim();

  req.cartOwner = req.user
    ? { userId: req.user.id, guestToken: null }
    : { userId: null, guestToken: guestHeader && guestHeader !== '' ? guestHeader : null };

  next();
};
