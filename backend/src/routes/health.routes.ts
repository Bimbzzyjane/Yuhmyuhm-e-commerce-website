import { Router } from 'express';
import type { AppConfig } from '../config/env';

/**
 * Liveness/readiness probe.
 *
 * Deliberately unauthenticated and dependency-free: it must answer even when
 * Supabase or Mailgun are unreachable, so a platform health check can tell
 * "the process is up" apart from "a dependency is down".
 */
export function createHealthRouter(config: AppConfig): Router {
  const router = Router();
  const startedAt = Date.now();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'yuhmyuhm-commerce-api',
      version: process.env.npm_package_version ?? '1.0.0',
      environment: config.env,
      dataBackend: config.dataBackend,
      mailTransport: config.mail.transport,
      currency: config.currency,
      deliveryFee: config.deliveryFee,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
