import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Gives every request a correlation id.
 *
 * A caller may supply one via `X-Request-Id` (useful for tracing from the
 * frontend), otherwise we generate one. The id is echoed back on the response
 * and included in every error payload, so a user can quote it to support.
 */
export const attachRequestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.trim() !== '' && incoming.length <= 128 ? incoming : randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
