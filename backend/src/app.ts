import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import type { AuthVerifier } from './auth/auth-verifier';
import type { AppConfig } from './config/env';
import type { Mailer } from './email';
import { createAuthMiddleware } from './middleware/auth';
import { resolveCartOwner } from './middleware/cart-owner';
import { createErrorHandler, notFoundHandler } from './middleware/error';
import { createCheckoutRateLimiter, createRateLimiter } from './middleware/rate-limit';
import { attachRequestId } from './middleware/request-id';
import type { Repositories } from './repositories/types';
import { createAuthRouter } from './routes/auth.routes';
import { createCartRouter } from './routes/cart.routes';
import { createCatalogRouter } from './routes/catalog.routes';
import { createHealthRouter } from './routes/health.routes';
import { createOrdersRouter } from './routes/orders.routes';
import { createCartService } from './services/cart.service';
import { createCatalogService } from './services/catalog.service';
import { createOrderService } from './services/order.service';

export interface AppDependencies {
  config: AppConfig;
  repositories: Repositories;
  mailer: Mailer;
  authVerifier: AuthVerifier;
}

/**
 * CORS: only the configured storefront origins are allowed.
 *
 * Requests without an `Origin` header (server-to-server, curl, the test suite)
 * are always permitted — CORS is a browser mechanism and blocking them would
 * break legitimate callers without adding any security.
 */
function corsOrigin(config: AppConfig) {
  const allowed = new Set(config.corsOrigins);
  const allowAll = allowed.has('*');

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowAll || allowed.has(origin)) {
      callback(null, true);
      return;
    }
    // No CORS headers are emitted, so the browser blocks the response. This is
    // intentionally a "deny quietly" rather than a 500.
    callback(null, false);
  };
}

/**
 * Builds the Express application.
 *
 * NOTE: this function NEVER calls `listen`. `server.ts` owns the socket, which
 * is what lets the test suite import this factory directly and run the real
 * app over supertest with no ports and no process lifecycle.
 *
 * Every collaborator is injected, so swapping Supabase for the in-memory
 * repositories, or Mailgun for the console transport, is a wiring change and
 * not a code change.
 */
export function createApp({
  config,
  repositories,
  mailer,
  authVerifier,
}: AppDependencies): Express {
  const app = express();

  // Do not advertise the framework.
  app.disable('x-powered-by');
  // Behind a proxy (Vercel/Render/Railway) so rate limiting can see the real
  // client. The hop count is configuration because it must match the actual
  // topology: trusting one hop too many lets a client forge its own address in
  // `X-Forwarded-For` and slip past the limiter, while trusting zero when a
  // proxy really is present makes every request look like it came from the
  // proxy. `0` (TRUST_PROXY_HOPS=0) therefore means "no proxy, ignore the
  // header" and is the right setting for local development.
  app.set('trust proxy', config.trustProxyHops);

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigin(config),
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Cart-Id', 'X-Request-Id'],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use(attachRequestId);
  if (config.logLevel !== 'silent') {
    app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  }
  app.use(createRateLimiter(config));

  // --- services ------------------------------------------------------------
  const catalog = createCatalogService({ repositories, config });
  const cart = createCartService({ repositories, config });
  const orders = createOrderService({ repositories, config, mailer, cartService: cart });
  const { identify, requireUser } = createAuthMiddleware({ verifier: authVerifier, repositories });
  // Checkout gets a second, stricter limiter on top of the global one.
  const checkoutRateLimiter = createCheckoutRateLimiter(config);

  // --- api -----------------------------------------------------------------
  // Health is registered before auth so probes never depend on a token.
  app.use('/api', createHealthRouter());
  app.use(identify);
  app.use(resolveCartOwner);

  app.use('/api', createCatalogRouter(catalog));
  app.use('/api/cart', createCartRouter(cart));
  app.use('/api/auth', createAuthRouter({ requireUser }));
  app.use('/api/orders', createOrdersRouter({ orders, requireUser, checkoutRateLimiter }));

  // --- fallbacks -----------------------------------------------------------
  app.use(notFoundHandler);
  app.use(createErrorHandler({ logErrors: config.logLevel !== 'silent' }));

  return app;
}
