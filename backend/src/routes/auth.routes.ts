import { Router, type RequestHandler } from 'express';
import { toUserProfile } from '../services/presenters';
import { UnauthorizedError } from '../utils/errors';

/**
 * Identity endpoints.
 *
 * The API never issues its own tokens: sign-in happens in the browser against
 * Supabase Auth (Google provider), and the resulting access token is verified
 * server-side on every request by the auth middleware.
 *
 * `GET /api/auth/me` therefore doubles as "exchange my token for my profile":
 * the first call creates the local user row, later calls refresh it.
 */
export function createAuthRouter(deps: { requireUser: RequestHandler }): Router {
  const router = Router();

  router.get('/me', deps.requireUser, (req, res) => {
    if (!req.user) {
      // Defensive: requireUser has already guaranteed this.
      throw new UnauthorizedError('Sign in to continue.');
    }
    res.json({ data: toUserProfile(req.user) });
  });

  return router;
}
