import rateLimit from 'express-rate-limit';
import type { AppConfig } from '../config/env';
import { AppError } from '../utils/errors';

/**
 * A blunt global limiter.
 *
 * The goal is only to stop a single client hammering the API; it is not a
 * substitute for per-account quotas. Disabled under test so the suite is
 * deterministic.
 */
export function createRateLimiter(config: AppConfig) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          'Too many requests from this address. Please slow down and try again shortly.',
          {
            code: 'RATE_LIMITED',
            status: 429,
          },
        ),
      );
    },
  });
}
