import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, NotFoundError, toAppError } from '../utils/errors';

/** Anything that reaches the end of the router chain is a 404. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route matches ${req.method} ${req.originalUrl}.`));
};

/**
 * The single place that converts a thrown value into an HTTP response.
 *
 *  - 4xx errors are surfaced with their message (they are written for users);
 *  - 5xx errors are logged in full and reported generically, so internals
 *    never leak to a client;
 *  - every payload carries a stable `code` and the request id.
 */
export function createErrorHandler(options: { logErrors: boolean }): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    // express.json() throws a SyntaxError on malformed JSON bodies.
    const isBodyParseError =
      error instanceof SyntaxError && 'body' in (error as unknown as Record<string, unknown>);
    const appError: AppError = isBodyParseError
      ? new AppError('The request body is not valid JSON.', {
          code: 'BAD_REQUEST',
          status: 400,
        })
      : toAppError(error);

    if (options.logErrors && appError.status >= 500) {
      console.error(`[${req.requestId}] ${req.method} ${req.originalUrl}`, error);
    }

    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.expose ? appError.message : 'Something went wrong on our side.',
        ...(appError.details === undefined ? {} : { details: appError.details }),
        requestId: req.requestId,
      },
    });
  };
}
