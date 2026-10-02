import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { AppConfig } from '../config/env';
import { AppError } from '../utils/errors';

/**
 * Both limiters reject through the central error handler, so a throttled
 * request looks like every other failure the API produces:
 *
 *   { "error": { "code": "RATE_LIMITED", "message": "…" } }
 *
 * A three-argument Express handler is assignable to express-rate-limit's
 * four-argument `handler` option, which is why this can be declared once and
 * shared rather than duplicated per limiter.
 */
const onRateLimited: RequestHandler = (_req, _res, next) => {
  next(
    new AppError('Too many requests from this address. Please slow down and try again shortly.', {
      code: 'RATE_LIMITED',
      status: 429,
    }),
  );
};

/**
 * Shared store and header behaviour.
 *
 * The default `MemoryStore` is per-process, which is the honest trade-off for
 * this deployment: limits are approximate across horizontally scaled instances.
 * A shared store (Redis) is the follow-up if the API ever runs more than one
 * replica. The store's cleanup timer is unref'd, so it never holds the process
 * open — which is what keeps the test suite from hanging.
 */
const sharedBehaviour = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: onRateLimited,
} as const;

/**
 * A blunt global limiter for the whole API.
 *
 * Its only job is to stop one client hammering every endpoint at once; it is
 * not a per-account quota. The budget is deliberately generous, because a
 * single storefront page load fans out into several requests.
 *
 * There is intentionally NO `skip` for the test environment. A limiter that
 * switches itself off under test is a limiter nobody ever tests; instead the
 * suite configures a limit high enough to be irrelevant (see
 * `tests/helpers/test-app.ts`) and `tests/rate-limit.test.ts` exercises this
 * middleware directly with a deliberately tiny limit.
 */
export function createRateLimiter(config: AppConfig): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    ...sharedBehaviour,
  });
}

/**
 * A much tighter limiter mounted on `POST /api/orders` only.
 *
 * Checkout is the single anonymous endpoint that does real work — it writes an
 * order, decrements stock and sends an email — and guests must be able to use
 * it, so the client IP is the only handle available. Hence a dedicated budget
 * here rather than tightening the global limiter, which would punish ordinary
 * browsing: `GET /api/products` is not affected by this middleware at all.
 */
export function createCheckoutRateLimiter(config: AppConfig): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.checkoutRateLimit.windowMs,
    limit: config.checkoutRateLimit.max,
    ...sharedBehaviour,
  });
}
