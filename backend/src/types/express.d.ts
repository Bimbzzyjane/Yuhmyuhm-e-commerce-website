import type { AuthenticatedIdentity } from '../domain/types';
import type { UserRow } from '../repositories/types';
import type { CartOwner } from '../services/cart.service';

/**
 * Attach the per-request context to Express's Request type so route handlers
 * get real types instead of casts.
 *
 *  - `requestId`  : correlation id, also returned in the X-Request-Id header
 *  - `auth`       : verified identity, or null for anonymous callers
 *  - `user`       : the app's own user profile row (null when anonymous)
 *  - `cartOwner`  : derived by middleware; NEVER taken from the request body
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth: AuthenticatedIdentity | null;
      user: UserRow | null;
      cartOwner: CartOwner;
    }
  }
}

export {};
