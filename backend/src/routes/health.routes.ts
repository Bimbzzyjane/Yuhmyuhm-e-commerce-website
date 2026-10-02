import { Router } from 'express';

/**
 * Liveness/readiness probe.
 *
 * Deliberately unauthenticated and dependency-free: it must answer even when
 * Supabase or Mailgun are unreachable, so a platform health check can tell
 * "the process is up" apart from "a dependency is down".
 *
 * The body is deliberately minimal, because THIS ENDPOINT IS PUBLIC. It used to
 * report `dataBackend`, `mailTransport`, `currency`, `deliveryFee`,
 * `freeDeliveryThreshold` and `environment`, which told an anonymous caller
 * exactly which datastore to attack, whether emails were really being sent, and
 * the shop's whole pricing rules — none of which a health check needs, and all
 * of which a competitor would happily read. The useful operational detail is
 * logged once at boot by `server.ts` (which only operators can see) rather than
 * served to the internet.
 *
 * `{ status, service, uptimeSeconds }` is everything a load balancer needs:
 * a machine-readable state, a stable identifier, and a counter that proves the
 * response is live rather than a cached or replayed one.
 */
export function createHealthRouter(): Router {
  const router = Router();
  const startedAt = Date.now();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'yuhmyuhm-commerce-api',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    });
  });

  return router;
}
