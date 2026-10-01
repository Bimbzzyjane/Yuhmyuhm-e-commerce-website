import type { RequestHandler } from 'express';
import type { AuthVerifier } from '../auth/auth-verifier';
import type { Repositories } from '../repositories/types';
import { UnauthorizedError } from '../utils/errors';

export interface AuthMiddlewareDeps {
  verifier: AuthVerifier;
  repositories: Repositories;
}

/**
 * Populates `req.auth` / `req.user`.
 *
 * Semantics:
 *  - no Authorization header      -> anonymous (`req.user === null`), continue;
 *  - valid bearer token           -> set identity, create/lookup the profile;
 *  - present but invalid token    -> 401, so the client knows to refresh its
 *    session instead of silently losing access to its cart.
 */
export function createAuthMiddleware({ verifier, repositories }: AuthMiddlewareDeps) {
  const identify: RequestHandler = async (req, _res, next) => {
    try {
      const header = req.header('authorization');
      if (!header || !header.toLowerCase().startsWith('bearer ')) {
        req.auth = null;
        req.user = null;
        next();
        return;
      }

      const token = header.slice('bearer '.length).trim();
      const identity = await verifier.verify(token);

      req.auth = identity;
      // Upsert on every authenticated request: it is a cheap indexed lookup and
      // it keeps the profile in step with Google (name/avatar changes).
      req.user = await repositories.users.upsertFromIdentity(identity);
      next();
    } catch (error) {
      next(error);
    }
  };

  const requireUser: RequestHandler = (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError('Sign in to continue.'));
      return;
    }
    next();
  };

  return { identify, requireUser };
}
