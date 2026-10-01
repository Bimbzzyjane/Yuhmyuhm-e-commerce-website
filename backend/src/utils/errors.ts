/**
 * Typed application errors.
 *
 * Route handlers and services throw these; the single error middleware
 * (middleware/error.ts) is the only place that turns them into an HTTP
 * response. That keeps status codes and the JSON envelope consistent.
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'OUT_OF_STOCK',
  'EMPTY_CART',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface AppErrorOptions {
  code: ErrorCode;
  status: number;
  details?: unknown;
  /** Set to true only for errors that are safe to surface to end users. */
  expose?: boolean;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.expose = options.expose ?? options.status < 500;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request payload is invalid.', details?: unknown) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, details });
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'The request could not be processed.', details?: unknown) {
    super(message, { code: 'BAD_REQUEST', status: 400, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(message, { code: 'UNAUTHORIZED', status: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource.') {
    super(message, { code: 'FORBIDDEN', status: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super(message, { code: 'NOT_FOUND', status: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state.', details?: unknown) {
    super(message, { code: 'CONFLICT', status: 409, details });
  }
}

export class OutOfStockError extends AppError {
  constructor(message = 'The requested quantity is not available.', details?: unknown) {
    super(message, { code: 'OUT_OF_STOCK', status: 409, details });
  }
}

export class EmptyCartError extends AppError {
  constructor(message = 'Your cart is empty.') {
    super(message, { code: 'EMPTY_CART', status: 400 });
  }
}

/** Normalises anything thrown into an AppError so the middleware has one path. */
export function toAppError(cause: unknown): AppError {
  if (cause instanceof AppError) return cause;
  if (cause instanceof Error) {
    return new AppError(cause.message, { code: 'INTERNAL_ERROR', status: 500, expose: false });
  }
  return new AppError('An unexpected error occurred.', {
    code: 'INTERNAL_ERROR',
    status: 500,
    expose: false,
  });
}
